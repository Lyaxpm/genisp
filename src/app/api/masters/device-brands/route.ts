import { NextRequest } from "next/server";
import { masterList, masterCreate, type MasterDef } from "../_lib";

export const dynamic = "force-dynamic";

const DEF: MasterDef = {
  table: "device_brands",
  label: "Merek perangkat",
  fields: ["name", "remark", "onu_type"],
  required: ["name"],
  searchFields: ["name", "remark", "onu_type"],
  order: "order by name asc",
};

export async function GET(req: NextRequest) {
  return masterList(DEF, req);
}

export async function POST(req: NextRequest) {
  return masterCreate(DEF, req);
}
