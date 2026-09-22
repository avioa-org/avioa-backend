import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { FeedQueryDto } from './dto/feed-query.dto';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import {
  RequireModule,
  RequireAction,
} from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';

@Controller('feed')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  findAll(@Query() query: FeedQueryDto, @CurrentUser('userId') user: string) {
    return this.feedService.findAll(query, user);
  }

  @Get('birthdays')
  getBirthdays() {
    return this.feedService.getBirthdaysThisMonth();
  }

  @Delete('comments/:commentId')
  @RequireModule(Modules.FEED)
  @RequireAction('delete')
  removeComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.removeComment(commentId, user);
  }

  @Get(':feedPostId')
  findOne(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.findOne(feedPostId, userId);
  }

  @Post()
  @RequireModule(Modules.FEED)
  @RequireAction('create')
  create(@Body() dto: CreatePostDto, @CurrentUser() user: ICurrentUser) {
    return this.feedService.create(dto, user);
  }

  @Patch(':feedPostId')
  @RequireModule(Modules.FEED)
  @RequireAction('update')
  update(
    @Param('feedPostId') feedPostId: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.update(feedPostId, dto, user);
  }

  @Delete(':feedPostId')
  @RequireModule(Modules.FEED)
  @RequireAction('delete')
  remove(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.remove(feedPostId, user);
  }

  @Patch(':feedPostId/pin')
  @RequireModule(Modules.FEED)
  @RequireAction('update')
  togglePin(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.togglePin(feedPostId, user);
  }

  @Post(':feedPostId/reactions')
  react(
    @Param('feedPostId') feedPostId: string,
    @Body() dto: CreateReactionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.react(feedPostId, dto, userId);
  }

  @Delete(':feedPostId/reactions')
  unreact(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.unreact(feedPostId, userId);
  }

  @Post(':feedPostId/comments')
  addComment(
    @Param('feedPostId') feedPostId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.addComment(feedPostId, dto, userId);
  }
}
