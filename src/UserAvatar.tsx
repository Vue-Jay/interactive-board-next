import "./userAvatar.css";

type Props={className?:string};

export default function UserAvatar({className}:Props){
 return <svg className={className||"user-avatar-icon"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="12" cy="8" r="3.4"/>
  <path d="M5.4 20.2a6.6 6.6 0 0 1 13.2 0"/>
 </svg>;
}
