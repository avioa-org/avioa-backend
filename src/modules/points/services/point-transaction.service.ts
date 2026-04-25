import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PointTransactionService {
  private readonly logger = new Logger(PointTransactionService.name);

  constructor() {}
}
