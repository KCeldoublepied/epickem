import { Module } from '@nestjs/common';
import { MyTournamentsController } from './my-tournaments.controller';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  controllers: [TournamentsController, MyTournamentsController],
  providers: [TournamentsService],
})
export class TournamentsModule {}
