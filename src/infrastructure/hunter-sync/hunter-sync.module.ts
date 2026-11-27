import {Module} from '@nestjs/common';
import {PrismaModule} from 'src/infrastructure/prisma/prisma.module';
import {HunterSyncService} from './hunter-sync.service';
@Module({imports:[PrismaModule],providers:[HunterSyncService],exports:[HunterSyncService]})
export class HunterSyncModule {}
