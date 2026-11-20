import {useEffect,useState} from "react";
import BoardApp from "./BoardApp";
import {clearDemoBoardAssets} from "./assetStore";
import type {DocumentData} from "./boardModel";
import type {BoardSummary} from "./boardStore";
import type {AuthUser} from "./authStore";

const title="Демо-версия доски";
const user:AuthUser={id:"lektrus-public-demo",name:"Гость",email:"",createdAt:"2026-01-01T00:00:00.000Z",isGuest:true};

export default function PublicDemoBoard({onExit=()=>window.location.assign("/")}:{onExit?:()=>void}={}){
 // Each mount is a fresh sandbox, including legacy scene/capture URLs.
 const [session]=useState(()=>{
  const id="lektrus-demo-"+crypto.randomUUID();
  const now=new Date().toISOString();
  const board:BoardSummary={id,title,ownerId:user.id,role:"owner",createdAt:now,updatedAt:now};
  const document:DocumentData={version:1,title,subject:"",view:{x:0,y:0,zoom:1},items:[],background:{mode:"dots",color:"#fbfcfe",opacity:100}};
  return {board,document};
 });
 useEffect(()=>()=>clearDemoBoardAssets(session.board.id),[session.board.id]);
 return <BoardApp key={session.board.id} authUser={user} boardSummary={session.board} accountRole="teacher" demoMode demoInitialDocument={session.document} onBackToBoards={onExit} onLogout={onExit} onBoardChanged={()=>{}}/>;
}
