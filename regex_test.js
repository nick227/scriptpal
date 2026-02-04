
const path = "/api/script/2/characters";
const regex = /^\/api\/script\/\d+\/(locations|characters|scenes|themes)/;
const match = path.match(regex);
console.log("Match:", match);
