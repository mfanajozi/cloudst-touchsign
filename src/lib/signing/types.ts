export type FieldType='SIGNATURE'|'INITIAL'|'DATE'|'DAY'|'MONTH'|'PLACE';
export interface PlacedField {id:string;signatory_id:string;page_number:number;type:FieldType;x_coord:number;y_coord:number;width:number;height:number;}
export interface Participant {id:string;name:string;}
