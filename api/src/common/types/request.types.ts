// This file uses declaration merging to add a 'user' property to the Express Request object.
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
  };
}
