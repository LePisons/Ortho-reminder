import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TodoistApi } from '@doist/todoist-api-typescript';

@Injectable()
export class TodoistService implements OnModuleInit {
  private readonly logger = new Logger(TodoistService.name);
  private apiToken: string | undefined;
  private projectId: string | undefined;
  private api: TodoistApi | undefined;

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
      this.apiToken = this.configService.get<string>('TODOIST_API_TOKEN');
      this.projectId = this.configService.get<string>('TODOIST_PROJECT_ID');

      if (this.apiToken) {
          this.api = new TodoistApi(this.apiToken);
          this.logger.log(`Todoist integration initialized. Token present: Yes. Project ID: ${this.projectId || 'None (Inbox)'}`);
      } else {
          this.logger.warn('Todoist integration initialized. Token present: NO. Integration will not work.');
      }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.debug('Syncing with Todoist...', TodoistService.name); // Corrected logger usage
    await this.sync();
  }

  async sync() {
    if (!this.api) {
      this.logger.warn('TODOIST_API_TOKEN not set, skipping sync.');
      return;
    }
    await this.pullFromTodoist();
  }

  async createTask(content: string, date: string, description?: string) {
    if (!this.api) {
        this.logger.warn('Cannot create task: Todoist API not initialized.');
        return null;
    }

    try {
      const taskData: any = {
        content,
        description,
        dueDate: date ? date.split('T')[0] : undefined, // SDK uses dueDate, not due_date
      };
      
      if (this.projectId) {
        taskData.projectId = this.projectId; // SDK uses projectId, not project_id
      }

      const task = await this.api.addTask(taskData);

      this.logger.log(`Successfully created Todoist task: ${task.id}`);
      return task.id;
    } catch (error) {
      this.logger.error(`Failed to create Todoist task: ${error.message}`);
      return null;
    }
  }

  async updateTask(taskId: string, content?: string, date?: string) {
     if (!this.api) return;
     try {
        const taskData: any = {};
        if (content) taskData.content = content;
        if (date) taskData.dueDate = date.split('T')[0];

        await this.api.updateTask(taskId, taskData);
        this.logger.log(`Successfully updated Todoist task: ${taskId}`);
     } catch (error) {
         this.logger.error(`Failed to update Todoist task: ${error.message}`);
     }
  }

  async deleteTask(taskId: string) {
      if (!this.api) return;
      try {
          await this.api.deleteTask(taskId);
          this.logger.log(`Successfully deleted Todoist task: ${taskId}`);
      } catch (error) {
          this.logger.error(`Failed to delete Todoist task: ${error.message}`);
      }
  }

  private async pullFromTodoist() {
      if (!this.api) return;

      try {
          // If projectId is set, filter by it. Otherwise fetch all active tasks
          const filter: any = {};
          if (this.projectId) {
              filter.projectId = this.projectId;
          }
          
          // SDK v6 returns paginated results: { results: Task[], nextCursor }
          const response = await this.api.getTasks(filter);
          const tasks = response.results || response;
          
          for (const task of tasks) {
              const localAppt = await this.prisma.appointment.findUnique({
                  where: { todoistTaskId: task.id },
              });

              if (localAppt) {
                  // Check if date changed
                  const taskDate = task.due?.date; // YYYY-MM-DD
                  if (taskDate) {
                      const localDate = localAppt.start.toISOString().split('T')[0];
                      if (taskDate !== localDate) {
                          // Update local appointment date (keep time)
                          const newStart = new Date(localAppt.start);
                          const [year, month, day] = taskDate.split('-').map(Number);
                          newStart.setFullYear(year, month - 1, day);
                          
                          const duration = localAppt.end.getTime() - localAppt.start.getTime();
                          const newEnd = new Date(newStart.getTime() + duration);

                          await this.prisma.appointment.update({
                              where: { id: localAppt.id },
                              data: {
                                  start: newStart,
                                  end: newEnd,
                              }
                          });
                          this.logger.log(`Updated appointment ${localAppt.id} from Todoist change.`);
                      }
                  }
              }
          }
      } catch (error) {
          this.logger.error(`Failed to pull from Todoist: ${error.message}`);
      }
  }
}
