import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// Columns safe to expose to clients — never includes the password hash.
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    if (createUserDto.role === 'REFERRER') throw new BadRequestException('Crea colegas desde Derivaciones para asignar un profesional receptor.');
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
      select: SAFE_USER_SELECT,
    });
  }

  findAll() {
    return this.prisma.user.findMany({ select: SAFE_USER_SELECT });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password && Buffer.byteLength(updateUserDto.password, 'utf8') > 72) throw new BadRequestException('La contraseña supera el máximo de 72 bytes.');
    const data = {
      ...updateUserDto,
      ...(updateUserDto.password ? { password: await bcrypt.hash(updateUserDto.password, 12), sessionVersion: { increment: 1 } } : {}),
    };
    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_USER_SELECT,
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
      select: SAFE_USER_SELECT,
    });
  }
}
