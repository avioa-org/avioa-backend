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
import { CanPublishGuard } from './guards/can-publish.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('feed')
@UseGuards(JwtAuthGuard)
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

  @Get(':feedPostId')
  findOne(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.findOne(feedPostId, userId);
  }

  @Post()
  @UseGuards(CanPublishGuard)
  create(@Body() dto: CreatePostDto, @CurrentUser() user: ICurrentUser) {
    return this.feedService.create(dto, user);
  }

  @Patch(':feedPostId')
  @UseGuards(CanPublishGuard)
  update(
    @Param('feedPostId') feedPostId: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.update(feedPostId, dto, user);
  }

  @Delete(':feedPostId')
  @UseGuards(CanPublishGuard)
  remove(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.remove(feedPostId, user);
  }

  @Patch(':feedPostId/pin')
  @UseGuards(CanPublishGuard)
  togglePin(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.togglePin(feedPostId, user);
  }

  @Post(':feedPostId/reactions')
  // @UseGuards(CanPublishGuard)
  react(
    @Param('feedPostId') feedPostId: string,
    @Body() dto: CreateReactionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.react(feedPostId, dto, userId);
  }

  @Delete(':feedPostId/reactions')
  // @UseGuards(CanPublishGuard)
  unreact(
    @Param('feedPostId') feedPostId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.unreact(feedPostId, userId);
  }

  @Post(':feedPostId/comments')
  // @UseGuards(CanPublishGuard)
  addComment(
    @Param('feedPostId') feedPostId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.feedService.addComment(feedPostId, dto, userId);
  }

  @Delete('comments/:commentId')
  @UseGuards(CanPublishGuard)
  removeComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.feedService.removeComment(commentId, user);
  }
}
