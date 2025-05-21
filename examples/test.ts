// // 상대 경로로 직접 가져오기
// import Tracer from "../dist/utils/tracer.js";
// // 함수 테스트

// function test2(a: number, b: number) {
//   // console.log("test2");
//   test3(a, b);
// }

// function test3(a: number, b: number) {
//   // console.log("test3");
//   test4((a + b).toString());
// }
// function test4(a: string) {
//   // console.log("test4");
//   test5(a);
// }
// function test5(a: string) {
//   // console.log("test5" + a);
// }

// Tracer.start();
// Tracer.run(() => {
//   test2(1, 2);
// });
// Tracer.end();
