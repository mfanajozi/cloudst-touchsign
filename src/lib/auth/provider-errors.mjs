export function classifyProviderError(error) {
 const code=typeof error?.code==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(error.code)?error.code:'UNKNOWN';
 const status=Number(error?.status)||0;
 if(code.toLowerCase()==='feature_not_supported')return {code,status:501,message:'This Neon branch does not support the requested administrator API. User profile and password changes remain available through My profile.'};
 if(['SIGN_UP_DISABLED','SIGNUP_DISABLED','SIGN_UP_NOT_ALLOWED'].includes(code))return {code,status:403,message:'Email signup is disabled on this Neon branch. Enable it in Neon Auth or create the login in Neon Console before linking it to this workspace.'};
 if(['INVALID_ORIGIN','INVALID_REFERER','INVALID_CALLBACK_URL','INVALID_REDIRECT_URL'].includes(code))return {code,status:403,message:'Neon Auth does not trust this application address. Ask your administrator to check the trusted domains on the branch used by this app.'};
 if(status===401||['UNAUTHORIZED','SESSION_EXPIRED','INVALID_SESSION'].includes(code))return {code,status:401,message:'Your Neon Auth session is no longer valid. Sign out, sign in again and retry.'};
 if(/^YOU_ARE_NOT_ALLOWED_TO_.*USER/.test(code)||['INSUFFICIENT_PERMISSIONS','ADMIN_ONLY'].includes(code))return {code,status:403,message:'Neon is not recognising this session as an administrator for this operation. Sign out and sign in again. If it persists, check the Auth role on the branch used by this app.'};
 if(['USER_ALREADY_EXISTS','USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL','EMAIL_ALREADY_EXISTS'].includes(code))return {code,status:409,message:'A Neon login already exists for this email address.'};
 if(['PASSWORD_TOO_SHORT','PASSWORD_TOO_LONG','PASSWORD_COMPROMISED'].includes(code))return {code,status:400,message:'The temporary password does not meet the authentication service’s password requirements.'};
 if(status>=500||code.startsWith('NETWORK_'))return {code,status:503,message:'The Neon user service is unavailable. Please try again.'};
 if(status===403)return {code,status:403,message:'Neon Auth rejected this account operation. Give your administrator the error reference so they can check the provider response.'};
 return {code,status:400,message:'Neon Auth could not complete this account change. Check the account details and try again.'};
}
