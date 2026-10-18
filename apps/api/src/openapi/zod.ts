import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Adds `.openapi()` to zod's prototypes. @hera/core resolves the same zod
// package, so its request schemas gain the method too.
extendZodWithOpenApi(z);

export { z };
