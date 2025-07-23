import { Injectable, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async signup(createUserDto: CreateUserDto) {
    // <-- Use the DTO here
    const existingUser = await this.usersService.findByEmail(
      createUserDto.email,
    ); // No more error!
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const user = await this.usersService.create(createUserDto); // No more error!

    const { password, ...result } = user;

    return result;
  }
}
