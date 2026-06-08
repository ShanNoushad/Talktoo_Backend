function _0x21f3(_0x33cf53, _0x263709) {
  const _0xed6c2b = _0xed6c();
  return (
    (_0x21f3 = function (_0x21f374, _0x49c023) {
      _0x21f374 = _0x21f374 - 0x119;
      let _0x4f55c4 = _0xed6c2b[_0x21f374];
      return _0x4f55c4;
    }),
    _0x21f3(_0x33cf53, _0x263709)
  );
}
const _0x233faa = _0x21f3;
(function (_0x5a985e, _0x2acc3b) {
  const _0xbc076e = _0x21f3,
    _0x3b0be9 = _0x5a985e();
  while (!![]) {
    try {
      const _0x1ad4da =
        -parseInt(_0xbc076e(0x12d)) / 0x1 +
        -parseInt(_0xbc076e(0x12e)) / 0x2 +
        parseInt(_0xbc076e(0x126)) / 0x3 +
        parseInt(_0xbc076e(0x131)) / 0x4 +
        -parseInt(_0xbc076e(0x134)) / 0x5 +
        parseInt(_0xbc076e(0x128)) / 0x6 +
        (-parseInt(_0xbc076e(0x119)) / 0x7) * (-parseInt(_0xbc076e(0x130)) / 0x8);
      if (_0x1ad4da === _0x2acc3b) break;
      else _0x3b0be9["push"](_0x3b0be9["shift"]());
    } catch (_0x17bad2) {
      _0x3b0be9["push"](_0x3b0be9["shift"]());
    }
  }
})(_0xed6c, 0x7866f);
const express = require(_0x233faa(0x11d)),
  route = express["Router"](),
  checkAccessWithSecretKey = require("../../util/checkAccess"),
  AdminController = require("../../controllers/admin/admin.controller"),
  multer = require(_0x233faa(0x12a)),
  storage = require("../../util/multer"),
  upload = multer({ storage: storage }),
  validateAdminAuth = require(_0x233faa(0x12f));
route["post"](_0x233faa(0x12c), checkAccessWithSecretKey(), AdminController[_0x233faa(0x11f)]),
  route[_0x233faa(0x11c)](_0x233faa(0x133), validateAdminAuth, checkAccessWithSecretKey(), AdminController[_0x233faa(0x136)]),
  route["patch"](_0x233faa(0x132), validateAdminAuth, checkAccessWithSecretKey(), upload["single"](_0x233faa(0x137)), AdminController[_0x233faa(0x11b)]),
  route["get"](_0x233faa(0x138), validateAdminAuth, checkAccessWithSecretKey(), AdminController[_0x233faa(0x125)]),
  route[_0x233faa(0x124)](_0x233faa(0x127), checkAccessWithSecretKey(), AdminController[_0x233faa(0x11e)]),
  route[_0x233faa(0x124)](_0x233faa(0x122), validateAdminAuth, checkAccessWithSecretKey(), AdminController[_0x233faa(0x12b)]),
  route[_0x233faa(0x124)](_0x233faa(0x123), checkAccessWithSecretKey(), AdminController[_0x233faa(0x11a)]),
  route[_0x233faa(0x135)](_0x233faa(0x120), checkAccessWithSecretKey(), AdminController[_0x233faa(0x121)]),
  (module[_0x233faa(0x129)] = route);
function _0xed6c() {
  const _0x146f6f = [
    "multer",
    "updatePassword",
    "/initiateAdminRegistration",
    "244985WJmJdt",
    "1285140quXvZv",
    "../../middleware/validateAdminAuth.middleware",
    "16gtCmAi",
    "2389188tYSImz",
    "/updateProfileDetails",
    "/authenticateAdmin",
    "952890hzdBgU",
    "get",
    "authenticateAdmin",
    "image",
    "/fetchAdminProfile",
    "2457847zakYbA",
    "confirmPasswordReset",
    "updateProfileDetails",
    "post",
    "express",
    "initiatePasswordReset",
    "initiateAdminRegistration",
    "/verifyAdminEmail",
    "verifyAdminEmail",
    "/updatePassword",
    "/confirmPasswordReset",
    "patch",
    "fetchAdminProfile",
    "297540BLUEif",
    "/initiatePasswordReset",
    "1035486yDiHIl",
    "exports",
  ];
  _0xed6c = function () {
    return _0x146f6f;
  };
  return _0xed6c();
}
