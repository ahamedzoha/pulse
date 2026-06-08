import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReassignDto } from './dto/reassign.dto';

// Board is admin + member only; pulse-viewer has no write/board access.
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('pulse-admin', 'pulse-member')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list() {
    return this.tasks.list();
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.getById(id);
  }

  @Get(':id/events')
  listEvents(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.listEvents(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user.userId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.tasks.updateStatus(user.userId, id, dto);
  }

  @Post(':id/comments')
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasks.comment(user.userId, id, dto);
  }

  @Patch(':id/assignee')
  reassign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignDto,
  ) {
    return this.tasks.reassign(user.userId, id, dto);
  }
}
