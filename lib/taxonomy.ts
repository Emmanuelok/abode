import baseDepartments from './departments.json';
export const departments=baseDepartments;
export const slugify=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const ghanaRegions=['Greater Accra','Ashanti','Western','Central','Eastern','Volta','Northern','Upper East','Upper West','Bono','Bono East','Ahafo','Western North','Oti','Savannah','North East'];
export const cities=['Sydney','Melbourne','Brisbane','Perth','Adelaide','Canberra','Hobart','Darwin','Gold Coast','Other location'];
export const money=(n:number)=>'GH₵ '+new Intl.NumberFormat('en-GH',{maximumFractionDigits:0}).format(n);
