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
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import {
  RequireModule,
  RequireAction,
} from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';

@Controller('forms')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class FormsController {
  constructor(private formsService: FormsService) {}

  @Post()
  @RequireModule(Modules.FORMS)
  @RequireAction('create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createFormDto: CreateFormDto) {
    return this.formsService.create(createFormDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.formsService.findAll({
      category,
      status,
      type,
    });
  }

  @Get('submissions/:submissionId')
  @RequireModule(Modules.FORMS)
  @HttpCode(HttpStatus.OK)
  getSubmission(@Param('submissionId') submissionId: string) {
    return this.formsService.getSubmission(submissionId);
  }

  @Put('submissions/:submissionId/status')
  @RequireModule(Modules.FORMS)
  @RequireAction('update')
  @HttpCode(HttpStatus.OK)
  updateSubmissionStatus(
    @Param('submissionId') submissionId: string,
    @Body() statusDto: UpdateSubmissionStatusDto,
  ) {
    return this.formsService.updateSubmissionStatus(submissionId, statusDto);
  }

  @Get(':formId/submissions')
  @RequireModule(Modules.FORMS)
  @HttpCode(HttpStatus.OK)
  getSubmissions(
    @Param('formId') formId: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.formsService.getSubmissions(formId, { status, userId });
  }

  @Put(':formId')
  @RequireModule(Modules.FORMS)
  @RequireAction('update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('formId') formId: string,
    @Body() updateFormDto: UpdateFormDto,
  ) {
    return this.formsService.update(formId, updateFormDto);
  }

  @Delete(':formId')
  @RequireModule(Modules.FORMS)
  @RequireAction('delete')
  @HttpCode(HttpStatus.OK)
  delete(@Param('formId') formId: string) {
    return this.formsService.delete(formId);
  }

  @Get(':formId')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('formId') formId: string) {
    return this.formsService.findOne(formId);
  }

  @Post(':formId/submit')
  @HttpCode(HttpStatus.CREATED)
  submitForm(
    @Param('formId') formId: string,
    @Body() submitFormDto: SubmitFormDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.formsService.submitForm(formId, user.userId, submitFormDto);
  }
}
