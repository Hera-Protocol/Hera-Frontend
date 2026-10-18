import type { PipeTransform } from "@nestjs/common";
import { notFound } from "./api-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are uuids; anything else can't exist, so it's a 404 rather than a 400. */
export class IdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw notFound();
    return value.toLowerCase();
  }
}
