import { Module } from '@nestjs/common';
import { MyTournamentsController } from './my-tournaments.controller';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  controllers: [TournamentsController, MyTournamentsController, RegistrationsController],
  providers: [TournamentsService, RegistrationsService],
})
export class TournamentsModule {}
