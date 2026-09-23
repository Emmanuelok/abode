export const departmentStyle:Record<string,{image:string;tone:string;eyebrow:string}>={
 'living-room':{image:'/images/living-room.webp',tone:'#8a6047',eyebrow:'THE ART OF EVERYDAY LIVING'},
 bedroom:{image:'/images/bedroom-edit.webp',tone:'#716450',eyebrow:'YOUR OWN LITTLE RETREAT'},
 dining:{image:'/images/dining-edit.webp',tone:'#70503d',eyebrow:'MAKE ROOM FOR GOOD COMPANY'},
 outdoor:{image:'/images/courtyard-edit.webp',tone:'#586e53',eyebrow:'LIFE, A LITTLE MORE OUTSIDE'},
 kitchen:{image:'/images/kitchen-edit.webp',tone:'#8c6845',eyebrow:'AT THE HEART OF YOUR HOME'},
 bath:{image:'/images/bath-edit.webp',tone:'#486a67',eyebrow:'EVERYDAY RITUALS, REIMAGINED'},
 office:{image:'/images/office-edit.webp',tone:'#576957',eyebrow:'SPACE FOR YOUR NEXT GREAT IDEA'},
 bedding:{image:'/images/bedroom-edit.webp',tone:'#857359',eyebrow:'SOFTER LANDINGS. SLOWER MORNINGS.'},
 'window-treatments':{image:'/images/bedroom.webp',tone:'#8b705b',eyebrow:'FRAME YOUR WORLD'},
 'garden':{image:'/images/courtyard-edit.webp',tone:'#4b6952',eyebrow:'A LITTLE CLOSER TO NATURE'},
 'entryway':{image:'/images/living-room.webp',tone:'#8a5b42',eyebrow:'A WARM WELCOME HOME'},
 'cleaning':{image:'/images/kitchen-edit.webp',tone:'#58706b',eyebrow:'A FRESH START, EVERY DAY'},
 'cooling':{image:'/images/living-room.webp',tone:'#496b75',eyebrow:'MAKE YOURSELF COMFORTABLE'},
 'fitness':{image:'/images/office-edit.webp',tone:'#796553',eyebrow:'ROOM TO MOVE'},
 'tools':{image:'/images/office-edit.webp',tone:'#756650',eyebrow:'MAKE YOUR NEXT PROJECT HAPPEN'}
};
export function getDepartmentStyle(slug?:string){return departmentStyle[slug||'']||{image:'',tone:'#89654e',eyebrow:'THE DETAILS MAKE IT YOURS'}}
