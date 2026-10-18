import { Module } from "@nestjs/common";
import { TravelRuleController } from "./travel-rule.controller";
import { TravelRuleService } from "./travel-rule.service";

@Module({
  controllers: [TravelRuleController],
  providers: [TravelRuleService],
  exports: [TravelRuleService],
})
export class TravelRuleModule {}
