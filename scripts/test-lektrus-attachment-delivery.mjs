import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/boardAttachmentApprovalSync.ts");
const board=read("src/BoardApp.tsx");
const exports={};
let status,receive,fail=true,closed=false;
let snapshot={requests:[],results:[]};
const attempted=[],delivered=[];
const transport=Object.assign(()=>{closed=true},{sendEvent:frame=>{
 attempted.push(frame);if(fail)return false;delivered.push(frame);return true;
}});
const mock={isSelfhostBackendEnabled:()=>true,selfhostListAttachmentApprovals:async()=>snapshot,selfhostSubscribeBoard:(_id,_version,onStatus,onEvent)=>{
 status=onStatus;receive=onEvent;return transport;
}};
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
new Function("exports","require",compiled.outputText)(exports,name=>name==="./selfhostApi"?mock:{});
const results=[];
const channel=exports.connectAttachmentApprovalChannel("board",{userId:"student",name:"Student"},()=>{},r=>results.push(r));
const request={requestId:"req",studentId:"student",studentName:"Student",assetId:"asset",name:"file.png",mime:"image/png",kind:"image",width:100,height:100,sentAt:1};
try{
 for(let i=0;i<50;i++)channel.request(request);
 assert.equal(attempted.length,0);
 status("online");
 assert.equal(attempted.length,1,"Repeated offline request must coalesce");
 fail=false;
 await new Promise(resolve=>setTimeout(resolve,650));
 assert.equal(delivered.length,1,"Failed transport send must be retried");
 assert.equal(delivered[0].request_id,"req");
 status("offline");
 channel.result({requestId:"req",studentId:"student",approved:true,name:"file.png"});
 status("online");
 await new Promise(resolve=>setTimeout(resolve,200));
 assert.equal(delivered.length,2);
 receive({type:"attachment_result",request_id:"req",target_user_id:"other",approved:true,attachment_name:"file.png"});
 assert.equal(results.length,0);
 receive({type:"attachment_result",request_id:"req",target_user_id:"student",approved:true,attachment_name:"file.png"});
 assert.equal(results.length,1);
 // Recovered decisions precede old requests; teacher-facing durable results
 // are processed while unrelated legacy targeted events remain ignored.
 snapshot={requests:[{type:"attachment_request",request_id:"old",user_id:"student",asset_id:"asset",durable:true}],
           results:[{type:"attachment_result",request_id:"old",target_user_id:"other",approved:false,attachment_name:"old.png",durable:true}]};
 status("offline");status("online");
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(results.length,2);
 assert.equal(results[1].durable,true);
 assert.equal(results[1].requestId,"old");
}finally{channel.close()}
assert.equal(closed,true);
assert.match(board,/id:"approved-media-"\+request.requestId/);
assert.match(board,/confirmAttachmentDecisions\(data\)/);
assert.match(board,/if\(acknowledgedBoardData.current\)confirmAttachmentDecisions\(acknowledgedBoardData.current\)/);
assert.match(board,/replayPending\(true\)/);
assert.match(board,/selfhostDecideAttachment\(boardSummary.id,request.requestId,approved,position\)/);
assert.match(board,/if\(response.inserted_item\)/);
assert.match(board,/localStorage\.setItem\(attachmentPendingKey/);
console.log("Attachment delivery: coalesced offline retries, failed transport recovery, target isolation and durable approval wiring.");
