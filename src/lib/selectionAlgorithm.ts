import { User } from "@prisma/client";

export function selectParticipants(
  activeStaffMembers: User[],    // status: "active" かつ role: 'member'
  excludedThisRound: string[],     // 主催者が当回除外したメンバーのID
  previousParticipantIds: string[], // 直前回の参加者ID
  selectCount: number = 4
): User[] {
  
  // 除外適用後の候補
  const candidates = activeStaffMembers.filter(
    m => !excludedThisRound.includes(m.id)
  );
  
  // 候補が4名以下なら全員選定（連続抑制解除）
  if (candidates.length <= selectCount) {
    return candidates;
  }
  
  // 重み付き抽選
  // 直前回参加者: weight 0.3、それ以外: weight 1.0
  const weights = candidates.map(m =>
    previousParticipantIds.includes(m.id) ? 0.3 : 1.0
  );
  
  const selected: User[] = [];
  const pool = [...candidates];
  const poolWeights = [...weights];
  
  for (let i = 0; i < selectCount; i++) {
    const totalWeight = poolWeights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    
    for (let j = 0; j < pool.length; j++) {
      rand -= poolWeights[j];
      if (rand <= 0) {
        selected.push(pool[j]);
        pool.splice(j, 1);
        poolWeights.splice(j, 1);
        break;
      }
    }
  }
  
  return selected;
}
