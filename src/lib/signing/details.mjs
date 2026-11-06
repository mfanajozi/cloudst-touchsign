import {SigningInputError} from './validation.mjs';

export const signingMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function signingDefaults(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'numeric',year:'numeric'}).formatToParts(now);
 const value=type=>Number(parts.find(part=>part.type===type).value);
 return {day:value('day'),month:value('month'),year:value('year')};
}
export function signingDetails(input,now=new Date()){
 const year=signingDefaults(now).year;
 if(!input||!Number.isInteger(input.day)||!Number.isInteger(input.month)||input.month<1||input.month>12||input.day<1||input.day>new Date(Date.UTC(year,input.month,0)).getUTCDate())throw new SigningInputError('Choose a valid signing day and month.');
 const place=typeof input.place==='string'?input.place.trim().replace(/\s+/g,' '):'';
 if(place.length<2||place.length>40||/[\u0000-\u001f\u007f]/.test(place))throw new SigningInputError('Enter a signing place of 2–40 characters.');
 return {day:input.day,month:input.month,year,place};
}
