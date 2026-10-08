import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReferralStatus } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import {
  detectImageContentType,
  extensionForContentType,
} from '../storage/image-validation';
import { isValidStl } from '../storage/stl-validation';
import {
  AcceptReferralDto,
  CreateColleagueDto,
  ReferralInputDto,
  SetupDto,
  SharePatientDto,
  PHOTO_VIEWS,
} from './referrals.dto';

export interface ReferralActor {
  userId: string;
  role: string;
}
const personSelect = { id: true, name: true, email: true } as const;
const colleagueSelect = {
  ...personSelect,
  disabledAt: true,
  mustChangePassword: true,
  createdAt: true,
} as const;
const fileSelect = {
  id: true,
  name: true,
  kind: true,
  photoView: true,
  size: true,
  uploadedBy: true,
  createdAt: true,
} as const;
const normalizeRut = (value: string) =>
  value.replace(/[.\s-]/g, '').toUpperCase();

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  private admin(actor: ReferralActor) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException();
  }

  private scope(actor: ReferralActor): Prisma.ReferralWhereInput {
    if (actor.role === 'ADMIN') return { ownerId: actor.userId };
    if (actor.role === 'REFERRER')
      return {
        referrerId: actor.userId,
        revokedAt: null,
        OR: [{ patientId: null }, { patient: { deletedAt: null } }],
      };
    throw new ForbiddenException();
  }

  async access(id: string, actor: ReferralActor) {
    const record = await this.prisma.referral.findFirst({
      where: { id, ...this.scope(actor) },
    });
    if (!record) throw new NotFoundException('Derivación no disponible.');
    return record;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: ReferralActor,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const result = await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action,
        entity: 'Referral',
        entityId,
        metadata,
      },
    });
    if (
      actor.role === 'REFERRER' &&
      [
        'CREATE',
        'UPDATE',
        'SUBMIT',
        'COMMENT',
        'UPLOAD',
        'PHOTO_CLASSIFIED',
      ].includes(action)
    ) {
      await tx.referralNotificationEvent.create({
        data: { referralId: entityId, action },
      });
    }
    return result;
  }

  listColleagues(actor: ReferralActor) {
    this.admin(actor);
    return this.prisma.user.findMany({
      where: { role: 'REFERRER', referralOwnerId: actor.userId },
      select: colleagueSelect,
      orderBy: { name: 'asc' },
    });
  }

  async createColleague(dto: CreateColleagueDto, actor: ReferralActor) {
    this.admin(actor);
    const temporaryPassword = randomBytes(18).toString('base64url');
    const password = await bcrypt.hash(temporaryPassword, 12);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            ...dto,
            password,
            role: 'REFERRER',
            referralOwnerId: actor.userId,
            mustChangePassword: true,
          },
          select: colleagueSelect,
        });
        await this.audit(tx, actor, 'COLLEAGUE_CREATED', created.id);
        return created;
      });
      return { ...user, temporaryPassword };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Ese correo ya tiene una cuenta.');
      throw error;
    }
  }

  async colleagueAccess(id: string, enabled: boolean, actor: ReferralActor) {
    this.admin(actor);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id, role: 'REFERRER', referralOwnerId: actor.userId },
        data: {
          disabledAt: enabled ? null : new Date(),
          sessionVersion: { increment: 1 },
        },
      });
      if (!updated.count) throw new NotFoundException();
      await this.audit(
        tx,
        actor,
        enabled ? 'COLLEAGUE_ENABLED' : 'COLLEAGUE_DISABLED',
        id,
      );
      return { success: true };
    });
  }

  async resetPassword(id: string, actor: ReferralActor) {
    this.admin(actor);
    const temporaryPassword = randomBytes(18).toString('base64url');
    const password = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id, role: 'REFERRER', referralOwnerId: actor.userId },
        data: {
          password,
          mustChangePassword: true,
          sessionVersion: { increment: 1 },
        },
      });
      if (!updated.count) throw new NotFoundException();
      await this.audit(tx, actor, 'COLLEAGUE_PASSWORD_RESET', id);
    });
    return { temporaryPassword };
  }

  list(actor: ReferralActor) {
    return this.prisma.referral.findMany({
      where: this.scope(actor),
      select: {
        id: true,
        fullName: true,
        status: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        referrer: { select: personSelect },
        _count: { select: { files: true, comments: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  shareablePatients(actor: ReferralActor) {
    this.admin(actor);
    return this.prisma.patient.findMany({
      where: { userId: actor.userId, deletedAt: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  forPatient(patientId: string, actor: ReferralActor) {
    this.admin(actor);
    return this.prisma.referral.findMany({
      where: { patientId, ownerId: actor.userId },
      select: { id: true, revokedAt: true, referrer: { select: personSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(id: string, actor: ReferralActor) {
    await this.access(id, actor);
    const record = await this.prisma.referral.findFirst({
      where: { id, ...this.scope(actor) },
      include: {
        referrer: { select: personSelect },
        files: { select: fileSelect, orderBy: { createdAt: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
        setups: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!record) throw new NotFoundException();
    await this.audit(this.prisma, actor, 'READ', id);
    // Explicit projection only: never serialize the internal patient record.
    const sharedProgress = record.patientId
      ? await this.prisma.patient.findFirst({
          where: {
            id: record.patientId,
            userId: record.ownerId,
            deletedAt: null,
          },
          select: { status: true, currentAligner: true, totalAligners: true },
        })
      : null;
    return {
      ...record,
      sharedProgress,
      patientId: actor.role === 'ADMIN' ? record.patientId : undefined,
    };
  }

  async create(dto: ReferralInputDto, actor: ReferralActor) {
    const { treatment, ...patientData } = dto;
    if (actor.role !== 'REFERRER') throw new ForbiddenException();
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      include: { referralOwner: true },
    });
    if (
      !user?.referralOwnerId ||
      user.referralOwner?.role !== 'ADMIN' ||
      user.referralOwner.disabledAt
    )
      throw new ForbiddenException(
        'No hay un profesional receptor habilitado.',
      );
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.referral.create({
        data: {
          ...patientData,
          ...(treatment ? { treatment: { ...treatment } } : {}),
          ownerId: user.referralOwnerId!,
          referrerId: actor.userId,
        },
      });
      await this.audit(tx, actor, 'CREATE', record.id);
      return record;
    });
  }

  async edit(id: string, dto: ReferralInputDto, actor: ReferralActor) {
    const { treatment, ...patientData } = dto;
    const record = await this.access(id, actor);
    if (!['DRAFT', 'NEEDS_INFO'].includes(record.status))
      throw new ConflictException('Los datos enviados ya no pueden editarse.');
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.referral.updateMany({
        where: { id, ...this.scope(actor), status: record.status },
        data: {
          ...patientData,
          ...(treatment ? { treatment: { ...treatment } } : {}),
        },
      });
      if (!changed.count)
        throw new ConflictException('El caso cambió. Actualiza la página.');
      await this.audit(tx, actor, 'UPDATE', id);
      return { success: true };
    });
  }

  async submit(id: string, actor: ReferralActor) {
    const record = await this.access(id, actor);
    if (
      actor.role !== 'REFERRER' ||
      !['DRAFT', 'NEEDS_INFO'].includes(record.status)
    )
      throw new ConflictException('Esta derivación no puede enviarse.');
    return this.prisma.$transaction(async (tx) => {
      const files = await tx.referralFile.findMany({
        where: { referralId: id },
        select: { kind: true },
      });
      if (
        !files.some((f) => f.kind === 'STL_UPPER') ||
        !files.some((f) => f.kind === 'STL_LOWER')
      )
        throw new BadRequestException(
          'Adjunta los STL superior e inferior antes de enviar.',
        );
      const changed = await tx.referral.updateMany({
        where: { id, ...this.scope(actor), status: record.status },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      if (!changed.count)
        throw new ConflictException('El caso cambió. Actualiza la página.');
      await this.audit(tx, actor, 'SUBMIT', id);
      return { success: true };
    });
  }

  async comment(
    id: string,
    content: string,
    actor: ReferralActor,
    requestInfo = false,
  ) {
    await this.access(id, actor);
    if (!content.trim())
      throw new BadRequestException('Escribe un comentario.');
    if (requestInfo) this.admin(actor);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.referral.updateMany({
        where: {
          id,
          ...this.scope(actor),
          ...(requestInfo
            ? {
                status: { in: ['SUBMITTED', 'NEEDS_INFO'] as ReferralStatus[] },
              }
            : {}),
        },
        data: {
          updatedAt: new Date(),
          ...(requestInfo ? { status: 'NEEDS_INFO' as const } : {}),
        },
      });
      if (!changed.count)
        throw new ConflictException('El caso cambió o ya no está disponible.');
      const comment = await tx.referralComment.create({
        data: {
          referralId: id,
          authorId: actor.userId,
          authorName: user.name || user.email,
          content: content.trim(),
        },
      });
      await this.audit(tx, actor, requestInfo ? 'REQUEST_INFO' : 'COMMENT', id);
      return comment;
    });
  }

  async setup(id: string, dto: SetupDto, actor: ReferralActor) {
    this.admin(actor);
    await this.access(id, actor);
    const url = new URL(dto.url);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new BadRequestException('Usa un enlace HTTPS sin credenciales.');
    return this.prisma.$transaction(async (tx) => {
      const setup = await tx.referralSetup.create({
        data: { ...dto, referralId: id, createdBy: actor.userId },
      });
      await tx.referral.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      await this.audit(tx, actor, 'SETUP_SHARED', id);
      return setup;
    });
  }

  async revoke(id: string, actor: ReferralActor) {
    this.admin(actor);
    await this.access(id, actor);
    return this.prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      await this.audit(tx, actor, 'REVOKE', id);
      return { success: true };
    });
  }

  async duplicates(id: string, actor: ReferralActor) {
    this.admin(actor);
    const record = await this.access(id, actor);
    const patients = await this.prisma.patient.findMany({
      where: { userId: actor.userId },
      select: {
        id: true,
        fullName: true,
        rut: true,
        email: true,
        phone: true,
        deletedAt: true,
      },
    });
    return patients.filter(
      (p) =>
        normalizeRut(p.rut) === normalizeRut(record.rut) ||
        p.email.toLowerCase() === record.email.toLowerCase() ||
        p.phone === record.phone,
    );
  }

  async accept(id: string, dto: AcceptReferralDto, actor: ReferralActor) {
    this.admin(actor);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const record = await tx.referral.findFirst({
            where: { id, ownerId: actor.userId, revokedAt: null },
          });
          if (!record || record.status !== 'SUBMITTED')
            throw new ConflictException(
              'Solo se pueden aceptar derivaciones enviadas y vigentes.',
            );
          let patientId = dto.patientId;
          if (patientId) {
            const patient = await tx.patient.findFirst({
              where: { id: patientId, userId: actor.userId, deletedAt: null },
            });
            if (!patient)
              throw new NotFoundException('Paciente no disponible.');
          } else {
            const patients = await tx.patient.findMany({
              where: { userId: actor.userId },
              select: { rut: true },
            });
            if (
              patients.some(
                (p) => normalizeRut(p.rut) === normalizeRut(record.rut),
              )
            )
              throw new ConflictException(
                'Ya existe un paciente con ese RUT. Vincula su ficha.',
              );
            const patient = await tx.patient.create({
              data: {
                userId: actor.userId,
                fullName: record.fullName,
                rut: record.rut,
                email: record.email,
                phone: record.phone,
                treatmentStartDate: new Date(),
                changeFrequency: 14,
                status: 'PAUSED',
                // No tracking, onboarding, messaging, or laboratory side effects.
              },
            });
            patientId = patient.id;
          }
          await tx.referral.update({
            where: { id },
            data: { status: 'ACCEPTED', acceptedAt: new Date(), patientId },
          });
          await this.audit(tx, actor, 'ACCEPT', id, { patientId });
          return { patientId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'Ya existe un paciente coincidente o el caso cambió. Revisa las coincidencias y vuelve a intentarlo.',
        );
      throw error;
    }
  }

  async share(dto: SharePatientDto, actor: ReferralActor) {
    this.admin(actor);
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, userId: actor.userId, deletedAt: null },
    });
    const colleague = await this.prisma.user.findFirst({
      where: {
        id: dto.referrerId,
        role: 'REFERRER',
        referralOwnerId: actor.userId,
        disabledAt: null,
      },
    });
    if (!patient || !colleague) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.referral.create({
        data: {
          ownerId: actor.userId,
          referrerId: colleague.id,
          patientId: patient.id,
          fullName: patient.fullName,
          rut: patient.rut,
          email: patient.email,
          phone: patient.phone,
          reason: dto.reason,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      await this.audit(tx, actor, 'SHARE_PATIENT', record.id);
      return record;
    });
  }

  async upload(
    id: string,
    kind: string,
    file: Express.Multer.File,
    actor: ReferralActor,
    photoView = 'UNASSIGNED',
  ) {
    await this.access(id, actor);
    if (!file) throw new BadRequestException('Selecciona un archivo.');
    if (
      !PHOTO_VIEWS.includes(photoView as (typeof PHOTO_VIEWS)[number]) ||
      (kind !== 'PHOTO' && photoView !== 'UNASSIGNED')
    )
      throw new BadRequestException(
        'La vista solo se puede asignar a fotografías.',
      );
    const stl = ['STL_UPPER', 'STL_LOWER'].includes(kind);
    const contentType = stl
      ? isValidStl(file.buffer)
        ? 'model/stl'
        : null
      : detectImageContentType(file.buffer);
    if (!contentType)
      throw new BadRequestException(
        stl
          ? 'El archivo no es un STL válido.'
          : 'Usa una imagen JPG, PNG o WebP válida.',
      );
    const key = `referrals/${id}/${randomUUID()}.${stl ? 'stl' : extensionForContentType(contentType)}`;
    await this.r2.putObject(key, file.buffer, contentType);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock the case and recheck access after upload; revocation wins before publication.
        const changed = await tx.referral.updateMany({
          where: { id, ...this.scope(actor) },
          data: { updatedAt: new Date() },
        });
        if (!changed.count)
          throw new NotFoundException('Derivación no disponible.');
        const count = await tx.referralFile.count({
          where: { referralId: id },
        });
        if (count >= 60)
          throw new BadRequestException(
            'Este caso alcanzó el límite de 60 archivos.',
          );
        const asset = await tx.referralFile.create({
          data: {
            referralId: id,
            key,
            kind,
            photoView,
            contentType,
            size: file.size,
            name: file.originalname
              .replace(/[\x00-\x1f/\\]/g, '_')
              .slice(0, 180),
            uploadedBy: actor.userId,
          },
          select: fileSelect,
        });
        await this.audit(tx, actor, 'UPLOAD', id, { fileId: asset.id, kind });
        return asset;
      });
    } catch (error) {
      await this.r2.deleteObject(key).catch(() => undefined);
      throw error;
    }
  }

  async classifyPhoto(
    id: string,
    fileId: string,
    photoView: string,
    actor: ReferralActor,
  ) {
    await this.access(id, actor);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.referral.updateMany({
        where: { id, ...this.scope(actor), revokedAt: null },
        data: { updatedAt: new Date() },
      });
      if (!changed.count)
        throw new NotFoundException('Derivación no disponible.');
      const file = await tx.referralFile.updateMany({
        where: { id: fileId, referralId: id, kind: 'PHOTO' },
        data: { photoView },
      });
      if (!file.count) throw new NotFoundException('Fotografía no disponible.');
      await this.audit(tx, actor, 'PHOTO_CLASSIFIED', id, {
        fileId,
        photoView,
      });
      return { success: true };
    });
  }

  async download(id: string, fileId: string, actor: ReferralActor) {
    await this.access(id, actor);
    const file = await this.prisma.referralFile.findFirst({
      where: { id: fileId, referralId: id },
    });
    if (!file) throw new NotFoundException();
    await this.audit(this.prisma, actor, 'DOWNLOAD', id, { fileId });
    return { file, object: await this.r2.getObject(file.key) };
  }
}
