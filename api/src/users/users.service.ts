import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
// We don't need the Prisma type here anymore for the create method
import { CreateUserDto } from '../users/dto/create-user.dto';
export const roundsOfHashing = 10;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    // <-- Use the DTO here
    const hashedPassword = await bcrypt.hash(data.password, roundsOfHashing); // No more error!

    // Create the user using the DTO data and the new hashed password
    return this.prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        password: hashedPassword, // Use the secure hash
      },
    });
  }

  // The findByEmail method was already correct, TypeScript was just confused before.
  // It should no longer show an error.
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
