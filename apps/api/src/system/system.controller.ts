import { Controller, Get } from "@nestjs/common";
import { type ChainDto, listChains } from "@hera/core";
import { Public } from "../auth/access.decorators";

@Controller()
@Public()
export class SystemController {
  @Get("health")
  health(): { ok: true } {
    return { ok: true };
  }

  @Get("chains")
  chains(): ChainDto[] {
    return listChains().map(({ id, name, family, nativeSymbol, live }) => ({ id, name, family, nativeSymbol, live }));
  }
}
