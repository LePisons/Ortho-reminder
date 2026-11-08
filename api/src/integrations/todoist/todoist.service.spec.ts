import { TodoistService } from './todoist.service';

describe('Todoist batch lookup', () => {
  it('loads appointments once and updates only changed dates', async () => {
    const start = new Date('2026-11-08T12:00:00');
    const db: any = { appointment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'a', todoistTaskId: '1', start, end: new Date(start.getTime() + 3600000) },
        { id: 'b', todoistTaskId: '2', start, end: new Date(start.getTime() + 3600000) },
      ]), update: jest.fn(),
    } };
    const service = new TodoistService({} as any, db, {} as any);
    (service as any).api = { getTasks: jest.fn().mockResolvedValue({ results: [
      { id: '1', due: { date: '2026-11-09' } },
      { id: '2', due: { date: '2026-11-08' } },
      { id: 'unlinked', due: { date: '2026-11-10' } },
    ] }) };
    await service.sync();
    expect(db.appointment.findMany).toHaveBeenCalledTimes(1);
    expect(db.appointment.update).toHaveBeenCalledTimes(1);
    const change = db.appointment.update.mock.calls[0][0];
    expect(change.where).toEqual({ id: 'a' });
    expect(change.data.start.getDate()).toBe(9);
    expect(change.data.end.getTime() - change.data.start.getTime()).toBe(3600000);
  });
  it('does no work when integration is unconfigured', async () => {
    const service = new TodoistService({} as any, {} as any, {} as any);
    const sync = jest.spyOn(service, 'sync');
    await service.handleCron();
    expect(sync).not.toHaveBeenCalled();
  });
});
