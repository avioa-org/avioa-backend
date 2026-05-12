import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FormsService } from './forms.service';
import {
  CreateFormDto,
  UpdateFormDto,
  SubmitFormDto,
  UpdateSubmissionStatusDto,
} from './dto/create-form.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'src/common/enum/roles.enum';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';

@Controller('forms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormsController {
  constructor(private formsService: FormsService) {}

  @Post()
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createFormDto: CreateFormDto) {
    return this.formsService.create(createFormDto);
  }

  @Get()
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.formsService.findAll({ category, status, type });
  }

  @Get(':formId')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findOne(@Param('formId') formId: string) {
    return this.formsService.findOne(formId);
  }

  @Put(':formId')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('formId') formId: string,
    @Body() updateFormDto: UpdateFormDto,
  ) {
    return this.formsService.update(formId, updateFormDto);
  }

  @Delete(':formId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  delete(@Param('formId') formId: string) {
    return this.formsService.delete(formId);
  }

  @Post(':formId/submit')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  submitForm(
    @Param('formId') formId: string,
    @Body() submitFormDto: SubmitFormDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.formsService.submitForm(formId, user.userId, submitFormDto);
  }

  @Get(':formId/submissions')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  getSubmissions(
    @Param('formId') formId: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.formsService.getSubmissions(formId, { status, userId });
  }

  @Get('submissions/:submissionId')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  getSubmission(@Param('submissionId') submissionId: string) {
    return this.formsService.getSubmission(submissionId);
  }

  @Put('submissions/:submissionId/status')
  @Roles(Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  updateSubmissionStatus(
    @Param('submissionId') submissionId: string,
    @Body() statusDto: UpdateSubmissionStatusDto,
  ) {
    return this.formsService.updateSubmissionStatus(submissionId, statusDto);
  }
}
