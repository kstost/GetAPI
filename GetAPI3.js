(function () {
   var root = this;
   var GetAPI = function (options) {
      let pointer = this;
      pointer.opt = options;
      let keylist = ['url', 'libpath', 'debug'];
      keylist.forEach(key => {
         pointer[key] = options[key];
         delete options[key];
      });
   };
   GetAPI.prototype = {
      logging: function (str) {
         if (this.debug) {
            console.log(str);
         }
      },
      graph: function (query, limit) {
         this.logging('graph:' + limit);
         let pointer = this;
         if (limit === undefined) { limit = GetAPI.TRY_LIMIT + 0; }
         limit--;
         if (limit < 0) {
            return (async () => { })();
         }
         return (async () => {
            let fail_count = GetAPI.TRY_LIMIT + 0;
            let getting_token_fail = false;
            while (!pointer.get_key()) {
               this.logging('토큰가져오는과정')
               fail_count--;
               if (fail_count < 0) {
                  getting_token_fail = true;
                  break;
               }
               await pointer.refrese_token();
            }
            this.logging('과정');
            return await new Promise(ree => {
               let key = pointer.get_key();
               if (!key) {
                  pointer.logging('실패..');
                  if (getting_token_fail) {
                     ree({ error: GetAPI.NEEDLOGIN });
                  } else {
                     ree({ error: GetAPI.COMMONFAIL });
                  }
               } else {
                  pointer.logging('키 있음 ' + key);
                  let rv = {};
                  $.ajax({
                     url: pointer.url,
                     headers: {
                        'authorization': 'Bearer ' + key,
                        'content-type': "application/json",
                     },
                     async: true,
                     timeout: GetAPI.TIMEOUT,
                     type: "POST",
                     data: JSON.stringify(query),
                     dataType: "json",
                     beforeSend: function (jqXHR) { },
                     success: function (jqXHR, result, raw) {
                        if (!pointer.fail_for_inauth(jqXHR)) {
                           rv.result = jqXHR;
                        } else {
                           rv.error = jqXHR;
                           pointer.auth = null;
                        }
                     },
                     error: function (jqXHR) {
                        rv.error = jqXHR;
                     },
                     complete: function (jqXHR) {
                        if (rv.error || !pointer.auth) {
                           pointer.logging('실패');
                           // (async () => {
                           //    await pointer.graph(query, limit);
                           //    ree({ error: GetAPI.COMMONFAIL, body: rv.error });
                           // })();
                           if (pointer.auth) {
                              ree({ error: GetAPI.COMMONFAIL, body: rv.error });
                           } else {
                              ree({ error: GetAPI.NEEDLOGIN });
                           }
                        } else {
                           pointer.logging('성공');
                           ree({ error: GetAPI.SUCCESS, body: rv.result });
                        }
                     },
                  });
               }
            });
         })();
      },
      fail_for_inauth: function (jqXHR) {
         this.logging('fail_for_inauth:');
         try {
            if (!jqXHR.errors) {
               return;
            }
            if (!jqXHR.errors.length) {
               return;
            }
            if (jqXHR.errors[0].message !== 'Not Authorized') {
               return;
            }
            return true;
         } catch (e) {
            return;
         }
      },
      get_key: function () {
         this.logging('get_key:');
         let pointer = this;
         try {
            if (!pointer.auth) {
               return null;
            }
            return pointer.auth;
         } catch (e) { }
         return null;
      },
      init_amplify: function () {
         this.logging('init_amplify:');
         return new Promise((resolve, reject) => {
            let pointer = this;
            let added = true;
            if (!pointer.Amplify) {
               let selector = 'head>script[src="' + pointer.libpath + '"]';
               if (!document.querySelector(selector)) {
                  let script = document.createElement('script');
                  document.head.appendChild(script);
                  script.onerror = () => {
                     script.parentNode.removeChild(script);
                     reject();
                  };
                  script.onload = () => {
                     pointer.Amplify = aws_amplify.Amplify;
                     pointer.Auth = aws_amplify.Auth;
                     pointer.Amplify.configure({
                        Auth: pointer.opt
                     });
                     pointer.currentConfig = pointer.Auth.configure();
                     resolve();
                  }
                  script.src = pointer.libpath;
                  added = false;
               }
            }
            if (added) {
               if (pointer.currentConfig) {
                  resolve();
               } else {
                  reject();
               }
            }
         });
      },
      refrese_token: function () {
         this.logging('refrese_token:');
         let pointer = this;
         return (async () => {
            try {
               await pointer.init_amplify();
               const currSession = await pointer.Auth.currentSession();
               const token = currSession.getAccessToken();
               const newExp = token.decodePayload().exp;
               pointer.auth = token.getJwtToken();
               pointer.exp = newExp;
            } catch (error) {
               pointer.auth = null;
               pointer.exp = null;
            }
         })();
      },
   };
   root.GetAPI = GetAPI;
   root.GetAPI.TRY_LIMIT = 5;
   root.GetAPI.TIMEOUT = 1000 * 60;
   root.GetAPI.SUCCESS = 0; // 성공
   root.GetAPI.NEEDLOGIN = 1; // 인증안된상태일때
   root.GetAPI.COMMONFAIL = 2; // 인터넷 안될때, 서버측에서 200이외 응답경우
   root.GetAPI.init = function (opt) {
      if (!GetAPI.conn) {
         GetAPI.conn = new GetAPI(opt);
      }
      return GetAPI.conn;
   };
}).call(this);
