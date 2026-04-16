export const DEPARTMENT_TWITTER_HANDLES: Record<string, string> = {
  "DMRC": "@OfficialDMRC",
  "NHAI": "@NHAI_Official",
  "PWD": "@DelhiPwd",
  "MCD": "@MCD_Delhi",
  "NDMC": "@tweetndmc",
  "DJB": "@DelhiJalBoard",
  "DISCOM": "@bsesdelhi @tatapower_ddl",
  "DELHI_POLICE": "@DelhiPolice",
  "TRAFFIC_POLICE": "@dtptraffic",
  "FOREST_DEPT": "@dofwgnctd",
  "DPCC": "@DPCC_Pollution"
};

export function getTwitterHandleForDepartment(department: string | null | undefined): string {
  if (!department) return "@MCD_Delhi @LGDelhi"; // Fallback to general authorities
  const normalized = department.trim().toUpperCase();
  return DEPARTMENT_TWITTER_HANDLES[normalized] || "@MCD_Delhi @LGDelhi";
}
