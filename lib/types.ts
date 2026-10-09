export type Msg = {
  id: number;
  ts: Date;
  sender: string;
  text: string;
};

export type ItemKind = "deadline" | "event";
export type ItemStatus = "active" | "cancelled";
export type ItemAction = "new" | "update" | "cancel";

export type KnownItem = {
  id: number;
  status: ItemStatus;
  kind: ItemKind;
  title: string;
  location: string | null;
  day: string | null;
  time: string | null;
  day_msg_id: number | null;
  source_msg_ids: number[];
};

export type Known = Record<number, KnownItem>;

export type ExtractedItem = {
  action: ItemAction;
  updates_id: string | null;
  kind: ItemKind;
  title: string;
  location: string | null;
  day: string | null;
  time: string | null;
  day_msg_id: number | null;
  source_msg_ids: number[];
};

export type Clock = { hour: number; minute: number };

export type ResolvedItem = KnownItem & {
  when_date: Date | null;
  when_time: Clock | null;
};

export type TraceEntry = {
  window: number;
  from: number;
  to: number;
  itemCount: number;
  items: ExtractedItem[];
};

export type PipelineResult = {
  known: Known;
  msgs: Msg[];
  trace: TraceEntry[];
};
