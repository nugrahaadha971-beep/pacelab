import Dexie, { type Table } from 'dexie';
import type { UserProfile, Workout } from '../analytics/types';

class PacelabDB extends Dexie {
  workouts!: Table<Workout, number>;
  userProfile!: Table<UserProfile, string>;

  constructor() {
    super('pacelab');
    this.version(1).stores({
      workouts: '++id, date, source, workoutType',
      userProfile: 'id',
    });
  }
}

export const db = new PacelabDB();

export async function exportBackup(): Promise<string> {
  const [workouts, profiles] = await Promise.all([db.workouts.toArray(), db.userProfile.toArray()]);
  return JSON.stringify({ app: 'pacelab', version: 1, exportedAt: Date.now(), workouts, userProfile: profiles }, null, 2);
}

/** Mengganti seluruh data lokal dengan isi cadangan. */
export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (data?.app !== 'pacelab' || !Array.isArray(data.workouts)) throw new Error('Berkas cadangan tidak valid.');
  await db.transaction('rw', db.workouts, db.userProfile, async () => {
    await db.workouts.clear();
    await db.userProfile.clear();
    await db.workouts.bulkAdd(data.workouts.map(({ id: _id, ...w }: Workout) => w));
    if (data.userProfile?.[0]) await db.userProfile.put(data.userProfile[0]);
  });
}
