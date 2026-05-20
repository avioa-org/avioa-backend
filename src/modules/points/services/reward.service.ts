import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { CreateBulkRewardDto, CreateRewardDto } from '../dto/create-reward.dto';

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async createReward(createRewardDto: CreateRewardDto) {
    return this.prisma.reward.create({ data: createRewardDto });
  }

  public async createBulkRewards(rewards: CreateBulkRewardDto) {
    return this.prisma.reward.createMany({ data: rewards.data });
  }

  public async getRewards() {
    const rewards = await this.prisma.reward.findMany();
    return { rewards };
  }
}
