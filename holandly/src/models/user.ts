import mysql, { MysqlError } from 'mysql';
import { Request, Response} from 'express';
import moment from 'moment';

export const dbConnect = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '0',
    database: 'holandly'
  });

export let verifyUser = (username: any, password: any, done: any) => {
    dbConnect.query('select * from holandly.users where login=?', [username], function(err: MysqlError, usr: any, fields: any) {
      if (err) { return done(err); }
      if (usr.length === 0) { return done(null, false); }
      if(usr[0].password !== password) { return done(null, false);}
      return done(null, usr[0]);
    })
  }
/* returns events sorted by data, time and type */
export let sendScheduledEvents = (req: Request, res: Response) => {
    dbConnect.query(`select visitors.name, visitors.email, eventslist.date, eventslist.time, eventslist.patternId, eventvisitors.eventId, eventpattern.type, eventpattern.number,
                eventpattern.duration, eventpattern.description, visitCount.occupied from holandly.eventvisitors
                inner join visitors on eventvisitors.visitorId = visitors.visitorId
                inner join eventslist on eventvisitors.eventId = eventslist.eventId
                inner join eventpattern on eventslist.patternId = eventpattern.patternId
                left join (select eventId, COUNT(*) AS occupied from eventvisitors group by eventId) AS visitCount on eventslist.eventId = visitCount.eventId
                order by eventslist.date, eventslist.time, eventpattern.type;`
    , function(err: MysqlError, results: any, fields: any) {
      if(err) {
          console.log(err)
          res.json("Data retrieval failed");
      } else if(results.length > 0) {
        let scheduledEvents: any[] = [];
        let prevDate: any;
        let prevTime: any;
        let prevType: any;
        let isPrevDatePast: any;
        results.forEach(function(entry: any) {
          if(+entry.date === +prevDate) {
            delete entry.date;
            if(entry.time === prevTime && entry.type === prevType) {
              scheduledEvents[scheduledEvents.length - 1]
              .appointments[scheduledEvents[scheduledEvents.length - 1].appointments.length - 1]
              .visitors.push(makeVisitorObject(entry));
            } else {
              prevTime = entry.time;
              prevType = entry.type;
              scheduledEvents[scheduledEvents.length - 1].appointments.push(makeAppointment(entry, isPrevDatePast))
            }
          } else {
            let event: any = {};
            prevDate = event.date = entry.date;
            let mom = moment();
            event.isDatePast = isPrevDatePast = mom.isAfter(entry.date,'day');
            prevTime = entry.time;
            prevType = entry.type;
            delete entry.date;
            event.appointments = [makeAppointment(entry, isPrevDatePast)];
            scheduledEvents.push(event);
          }
        })
        res.send(JSON.stringify(scheduledEvents));
      } else {
        res.json("No scheduled events");
      } 
    })
  } 

  /* if the appointment is in 30 min or less, it is considered to be past*/
  const makeAppointment = (entry: any, isPrevDatePast: boolean) => {
    let momnt = moment();
    entry.isTimePast = isPrevDatePast ? true : momnt.add('30', 'm').isSameOrAfter(moment(entry.time, "hh:mm:ss")),
    entry.occupied = entry.occupied === null ? 0: entry.occupied
    entry.visitors = [makeVisitorObject(entry)]
    return entry;
  }

  const makeVisitorObject = (entry: any): any => {
    return {
      name: entry.name,
      email: entry.email,
    }
  }

export let sendEventPatterns = (req: Request, res: Response) => {
    dbConnect.query(`select * from eventpattern;`, function(err: MysqlError, results: any, fields: any) {
      if(err) {
        res.json("Data retrieval failed");
      } else if(results.length > 0) {
        res.end(JSON.stringify(results));
      } else {
        res.json("No patterns yet");
      }
    })
  }

  export let sendAvailableEvents = (req: Request, res: Response) => {
    let respObjects: any[] = [];
    dbConnect.query(`select eventslist.*, visitCount.occupied, eventpattern.number, eventpattern.type from holandly.eventslist
                      inner join eventpattern on eventslist.patternId = eventpattern.patternId
                      left join (select eventId, COUNT(*) AS occupied from eventvisitors group by eventId) AS visitCount on eventslist.eventId = visitCount.eventId
                      order by date, time;`
    , function(err: MysqlError, results: any, fields: any) {
      if(err) {
        res.json("Data retrieval failed");
      } else if(results.length > 0) {
          let mom = moment();
          results.map((entry: any) => {
            entry.occupied = null ? 0: entry.occupied;
            entry.isDatePast = mom.isAfter(entry.date,'day');
            entry.isTimePast = entry.isDatePast ? true : mom.add('30', 'm').isSameOrAfter(moment(entry.time, "hh:mm:ss")),
            entry.number = entry.number;
          })
        res.end(JSON.stringify(results));
      } else {
        res.json("No events to show");
      }
    })
  }

  export let addNewEventPattern = (req: Request, res: Response) => {
    let user = req.user.userId;
    console.log(user)
    let type = req.body.type;
    let pattern: any[] = [type, req.body.number, req.body.duration, req.body.description, user, type, user];
    dbConnect.query(`insert into eventpattern (type, number, duration, description, userId)
                      select ?, ?, ?, ?, ?
                      where not exists (select * from eventpattern where
                      (type=? and userId = ?));`, pattern, 
    function(err: any, results: any, fields: any) {
      if(err) {
        res.json("Error ocurred");
      } else if(results.affectedRows > 0) {
        res.json("Successful")
      } else {
        res.json('The operation is failed')
      }
    })
  }
  //new method to update existing pattern details      and p.duration=? and p.description=? and   req.body.duration, req.body.description,
  export let updateEventPattern = (req: Request, res: Response) => {
    let patternId: any = req.body.patternId;
    delete req.body.patternId;
    dbConnect.query(`update eventpattern set ?
                    where patternId=? and not exists (select * from
                    (select * from holandly.eventpattern p where (p.type=? and p.userId=? and patternId!=?)) as tmp)`
                    , [req.body, patternId, req.body.type, req.user.userId,  patternId], function(err: any, results: any, fields: any) {
      if(err) {
        res.json("Error ocurred");
      } else if(results.affectedRows > 0) {
        res.json("Successful")
      } else {
        res.json('The operation is failed')
      }
    })
  }

  export let deleteEventPattern = (req: Request, res: Response) => {
    let patternId: string = req.params[0];
    dbConnect.query(`delete from eventpattern where eventpattern.patternId = ?`, patternId, function(err: MysqlError, results: any, fields: any) {
      if(err) {
        res.json("Error ocurred");
      } else if(results.affectedRows > 0) {
        res.json("Successful")
      } else {
        res.json('The operation is failed')
      }
    })
  }

  export let deleteEvent = (req: Request, res: Response) => {
    let eventId: string[] = req.params[0];
    dbConnect.query(`delete from eventslist where eventslist.eventId = ?`, eventId, function(err: MysqlError, results: any, fields: any) {
      if(err) {
        res.json("Data retrieval failed");
      }  else if(results.affectedRows > 0) {
        res.json("Successful")
      } else {
        res.json('The operation is failed')
      }
    })
  }

  export let deleteEventVisitor = (req: Request, res: Response) => {
    let eventRecord: any = [req.body.eventId, req.body.email];
    dbConnect.query(`delete from eventvisitors where eventId = ? and visitorId = 
    (select visitors.visitorId from visitors where email=?)`, eventRecord, function(err: MysqlError, results: any, fields: any) {
      if(err) {
        res.json("Data retrieval failed");
      } else if(results.affectedRows > 0) {
        res.json("Successful")
      } else {
        res.json('The operation is failed')
      }
    })
  }

  export let addEvent = (req: Request, res: Response) => {
    let event: any = req.body;
    delete event[0].reason; //the reason is saved on front end in the form
    dbConnect.query(`insert into eventslist SET ? ON DUPLICATE KEY UPDATE time=?,date=?, patternId=?`
                      ,[event[0], event[0].time, event[0].date, event[0].patternId] , function(err: MysqlError, results: any, fields: any) {
      if(err) {
        res.json("Data retrieval failed");
      } else if(results.affectedRows > 0) {
        res.json("Successful")
      } else {
        res.json('The operation is failed')
      }
    })
  }