import { NextRequest } from "next/server";
import { masterList, masterCreate, type MasterDef } from "../_lib";

export const dynamic = "force-dynamic";

const DEF: MasterDef = {
  table: "connection_media",
  label: "Media koneksi",
  fields: ["name", "remark"],
  required: ["name"],
  searchFields: ["name", "remark"],
  order: "order by name asc",
};

export async function GET(req: NextRequest) {
  return masterList(DEF, req);
}

export async function POST(req: NextRequest) {
  return masterCreate(DEF, req);
}
