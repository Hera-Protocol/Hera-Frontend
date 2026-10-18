import { Injectable } from "@nestjs/common";
import { createLabelIndex, type LabelIndex, SEED_LABELS } from "@hera/core";

/**
 * The label index the engine scores against. Seeded from @hera/core today;
 * this is the seam where labels ingested into the database will plug in.
 */
@Injectable()
export class LabelsService {
  private readonly index: LabelIndex = createLabelIndex(SEED_LABELS);

  current(): LabelIndex {
    return this.index;
  }
}
