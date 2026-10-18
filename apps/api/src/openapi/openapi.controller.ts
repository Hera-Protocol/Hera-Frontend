import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/access.decorators";
import { buildOpenApiDocument, type OpenAPIObject } from "./document";

@Controller()
@Public()
export class OpenApiController {
  @Get("openapi.json")
  document(): OpenAPIObject {
    return buildOpenApiDocument();
  }
}
