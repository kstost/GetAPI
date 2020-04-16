(function () {
   var root = this;
   var GetAPI = function (options) {
      var pointer = this;
      pointer.opt = options;
      pointer.url = options.url;
      pointer.libpath = options.libpath;
      delete options.url;
      delete options.libpath;
   };
   GetAPI.prototype = {
      graph: function (query, limit) {
         let pointer = this;
         if (limit === undefined) { limit = GetAPI.TRY_LIMIT + 0; }
         return (async () => {
            let fail_count = GetAPI.TRY_LIMIT + 0;
            while (!pointer.get_key()) {
               fail_count--;
               if (fail_count < 0) { break; }
               await pointer.refrese_token();
            }
            let rtn = new Promise(ree => {
               let key = pointer.get_key();
               if (!key) {
                  ree();
               } else {
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
                           pointer.auth = null;
                        }
                     },
                     error: function (jqXHR) {
                        rv.error = jqXHR;
                     },
                     complete: function (jqXHR) {
                        let err = rv.error;
                        if (!err) {
                           if (!pointer.auth) {
                              limit--;
                              if (limit >= 0) {
                                 pointer.graph(query, limit);
                              } else {
                                 err = true;
                              }
                           } else {
                              ree(rv.result);
                           }
                        }
                        if (err) {
                           ree();
                        }
                     },
                  });
               }
            });
            return rtn;
         })();
      },
      fail_for_inauth: function (jqXHR) {
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
}).call(this);
