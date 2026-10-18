import { fetchEvmAccount, type BlockscoutOptions, type EvmAccountData } from "./adapters/blockscout";
import { fetchStellarAccount, type HorizonOptions } from "./adapters/horizon";
import { ChainDataError } from "./adapters/http";
import { CHAINS } from "./chains";
import type { LabelIndex } from "./labels";
import { scoreSubject } from "./risk";
import { subjectAddress } from "./subject";
import type { ScreeningResult, SubjectRef } from "./types";

export interface ScreenOptions extends HorizonOptions, Omit<BlockscoutOptions, "apiUrl"> {
  labels: LabelIndex;
  now?: Date;
}

/**
 * Fetch live chain data for a subject and score it.
 *
 * Never fails open on a labeled subject: if no chain source answers but the
 * subject carries direct labels (a sanctions listing above all), it is scored
 * on the labels alone, with `profile.dataStatus: "unavailable"` and a
 * CHAIN_DATA_PARTIAL reason. ChainDataError is thrown only when nothing came
 * back and there is nothing else to score on.
 */
export async function screenSubject(subject: SubjectRef, options: ScreenOptions): Promise<ScreeningResult> {
  const chain = CHAINS[subject.chain];
  if (!chain?.live) throw new ChainDataError(`Live screening isn't enabled for ${chain?.name ?? subject.chain} yet.`);

  let data: EvmAccountData;
  try {
    data =
      subject.chain === "stellar"
        ? await fetchStellarAccount(subject.account, options)
        : await fetchEvmAccount(subject.chain, subject.address, options);
  } catch (error) {
    if (!(error instanceof ChainDataError) || options.labels.get(subject.chain, subjectAddress(subject)).length === 0) throw error;
    data = {
      profile: {
        // Labels are only ever attached to addresses observed on-chain.
        exists: true,
        observedTransfers: 0,
        fullHistory: false,
        dataStatus: "unavailable",
        window: { pages: {}, records: 0, truncatedBy: error.kind === "timeout" ? "deadline" : "error", missing: ["all"] },
      },
      transfers: [],
      dustFiltered: 0,
    };
  }

  return scoreSubject({
    subject,
    profile: data.profile,
    transfers: data.transfers,
    dustFiltered: data.dustFiltered,
    labels: options.labels,
    now: options.now,
  });
}
