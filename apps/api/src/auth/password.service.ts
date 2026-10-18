import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

// OWASP's argon2id baseline: 19 MiB, 2 iterations, 1 lane.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Burn the same time as a real verify so login timing doesn't reveal which emails exist. */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash("hera-dummy-password-0");
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
