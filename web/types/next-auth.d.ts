import "next-auth";
import "next-auth/jwt";

// 1. We are extending the default "JWT" interface
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}

// 2. We are extending the default "Session" interface
declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}
