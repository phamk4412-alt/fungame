// TỰ SINH từ data.json bằng build-data.js — đừng sửa tay, hãy sửa data.json rồi chạy lại.
window.LCNT_DATA = {
  "meta": {
    "title": "LÁ CHẮN NGÔN TỪ",
    "subtitle": "5 giây trước nút Gửi",
    "tagline": "Một vụ bóc phốt sai sự thật. Ba vòng chơi. Một chỉ số Tinh thần cần được giữ lại.",
    "finalMessage": "Dừng 5 giây trước khi nhấn Gửi. Một bình luận có thể làm tổn thương, nhưng một lời đúng lúc có thể cứu một người."
  },
  "settings": {
    "hpStart": 100,
    "winHp": 50,
    "lowHp": 30,
    "midHp": 60,
    "round1": {
      "secondsPerItem": 20,
      "correctScore": 100,
      "speedBonusPerSecond": 5,
      "correctHp": 4,
      "wrongHp": -12,
      "timeoutHp": -12
    },
    "round2": {
      "duration": 60,
      "spawnStart": 3,
      "spawnEnd": 1.15,
      "riseStart": 13,
      "riseEnd": 7,
      "correctScore": 50,
      "comboBonus": 10,
      "comboCap": 10,
      "correctHp": 1,
      "wrongHp": -5,
      "missHp": -10
    },
    "round3": {
      "secondsPerSituation": 20,
      "dramaSeconds": 5,
      "jumpHp": 35,
      "timeoutHp": -10,
      "scorePerHp": 10
    },
    "failReviveHp": 15,
    "arena": {
      "secondsPerQuestion": 20,
      "stormCount": 5,
      "maxPoints": 1000,
      "minPoints": 500,
      "hitHp": 4,
      "missHp": -16,
      "timeoutHp": -10,
      "maxPlayers": 200,
      "roundVideos": true
    }
  },
  "teams": [
    "Đội Xanh",
    "Đội Đỏ",
    "Đội Vàng",
    "Đội Tím"
  ],
  "characters": {
    "victim": {
      "name": "Minh Anh",
      "handle": "@minhanh.k22",
      "bio": "Sinh viên năm 2 · Khoa Truyền thông · Thích vẽ và chụp film",
      "followers": "1.248",
      "avatar": {
        "skin": "#f5cdb0",
        "hair": "#2b1a14",
        "style": "long",
        "bg": [
          "#ff8fb1",
          "#a46bff"
        ],
        "accessory": "clip"
      }
    },
    "witness": {
      "name": "Hoàng Nam",
      "role": "Bạn cùng lớp của Minh Anh",
      "avatar": {
        "skin": "#e8b994",
        "hair": "#1b1b1f",
        "style": "short",
        "bg": [
          "#47c6ff",
          "#3a6bff"
        ],
        "accessory": "glasses"
      }
    },
    "page": {
      "name": "Hóng Biến Đại Học",
      "handle": "@hongbien.uni",
      "avatar": {
        "skin": "#ffd166",
        "hair": "#ef476f",
        "style": "page",
        "bg": [
          "#ff5f6d",
          "#ffc371"
        ]
      }
    }
  },
  "post": {
    "author": "page",
    "time": "2 giờ",
    "audience": "Công khai",
    "text": "🚨 BÓC PHỐT: Nữ sinh K22 khoa Truyền thông \"mua điểm\" giữa kỳ?! Điểm thi từ 5 lên 9.5 chỉ sau một đêm. Nguồn tin giấu tên khẳng định có giao dịch với giảng viên. Mọi người vào xem mặt và cho ý kiến 👇",
    "image": "Ảnh chụp màn hình bảng điểm đã bị cắt ghép",
    "reactions": "4,2K",
    "comments": "1,9K",
    "shares": "860",
    "truth": "Sự thật: Minh Anh thi lại vì ốm ở lần thi đầu, điểm 9.5 là điểm thi lại có biên bản của khoa. Bài đăng dùng ảnh bảng điểm cắt ghép."
  },
  "round1": {
    "name": "Soi Bóng Tối",
    "badge": "Màn 1 · Khởi động",
    "goal": "Nhận diện hành vi bạo lực mạng",
    "intro": "Bên dưới bài bóc phốt có hàng trăm bình luận. Hãy phân loại: đâu là GÓP Ý XÂY DỰNG, đâu là BẠO LỰC MẠNG?",
    "choices": {
      "constructive": {
        "label": "Góp ý xây dựng",
        "icon": "💬",
        "key": "A"
      },
      "bully": {
        "label": "Bạo lực mạng",
        "icon": "⚠️",
        "key": "B"
      }
    },
    "items": [
      {
        "author": "Trà My",
        "handle": "@tramy.03",
        "avatar": {
          "skin": "#f2c9a5",
          "hair": "#5a3825",
          "style": "bun",
          "bg": [
            "#7ef0c8",
            "#2bb3a3"
          ]
        },
        "time": "1 giờ",
        "text": "Nhìn cái mặt là biết loại gian lận rồi 🙄 Học thì dốt mà cứ thích làm màu, xấu người xấu cả nết.",
        "answer": "bully",
        "type": "Miệt thị ngoại hình, xúc phạm nhân phẩm",
        "explain": "Tấn công vào ngoại hình và con người, không bàn về sự việc. Đây là miệt thị, một dạng bạo lực mạng phổ biến nhất."
      },
      {
        "author": "Quốc Bảo",
        "handle": "@bao.nguyen",
        "avatar": {
          "skin": "#e0ac85",
          "hair": "#20140f",
          "style": "short",
          "bg": [
            "#ffd36e",
            "#ff9a3c"
          ]
        },
        "time": "58 phút",
        "text": "Mình nghĩ chưa nên kết luận khi chỉ có \"nguồn tin giấu tên\". Nên chờ khoa xác minh và nghe Minh Anh giải thích đã mọi người ạ.",
        "answer": "constructive",
        "type": "Góp ý có trách nhiệm",
        "explain": "Không công kích ai, nhắc mọi người kiểm chứng thông tin trước khi phán xét. Đây là cách góp ý văn minh."
      },
      {
        "author": "Người dùng ẩn danh",
        "handle": "@an.danh.247",
        "avatar": {
          "style": "anon",
          "bg": [
            "#3a3f55",
            "#1d2030"
          ]
        },
        "time": "45 phút",
        "text": "Nó ở trọ số 42 hẻm 7 đường Lý Thường Kiệt, sđt 09xx.xxx.318 nhé. Ai rảnh thì qua \"hỏi thăm\" giùm 😈",
        "answer": "bully",
        "type": "Doxxing: tung thông tin cá nhân",
        "explain": "Công khai địa chỉ, số điện thoại để kích động người khác tìm đến. Doxxing đe dọa trực tiếp sự an toàn và có thể bị xử lý theo pháp luật."
      },
      {
        "author": "Thu Hà",
        "handle": "@thuha.design",
        "avatar": {
          "skin": "#f7d3b8",
          "hair": "#8a4b2a",
          "style": "long",
          "bg": [
            "#c9a7ff",
            "#7b5cff"
          ]
        },
        "time": "30 phút",
        "text": "Page ơi, ảnh bảng điểm này có dấu hiệu bị cắt ghép, font chữ ở cột điểm bị lệch. Đăng tin chưa kiểm chứng kèm mặt người khác là không ổn đâu, nên gỡ bài.",
        "answer": "constructive",
        "type": "Góp ý xây dựng, chỉ ra sai sót",
        "explain": "Phê bình hành vi của page bằng lý lẽ và bằng chứng, đề xuất cách sửa. Góp ý có thể thẳng thắn mà vẫn không công kích."
      },
      {
        "author": "Đức Huy",
        "handle": "@huy.k21",
        "avatar": {
          "skin": "#d9a37f",
          "hair": "#2d2d2d",
          "style": "cap",
          "bg": [
            "#ff8a8a",
            "#d63b5c"
          ]
        },
        "time": "12 phút",
        "text": "Chắc chắn nó qua đêm với thầy để đổi điểm rồi, cả khoa ai cũng biết 🤫 Share mạnh cho bà con thấy bộ mặt thật!",
        "answer": "bully",
        "type": "Vu khống, bịa đặt xúc phạm danh dự",
        "explain": "Đưa ra điều không có thật, xúc phạm danh dự và kêu gọi lan truyền. Vu khống trên mạng gây hậu quả nặng nề và là hành vi vi phạm pháp luật."
      }
    ]
  },
  "round2": {
    "name": "Cơn Bão Bình Luận",
    "badge": "Màn 2 · Tăng tốc",
    "goal": "Kỹ năng tự vệ & xử lý khủng hoảng",
    "intro": "Bình luận ác ý trôi lên liên tục và ngày càng nhanh! Chọn ĐÚNG kỹ năng cho bình luận đang được đánh dấu MỤC TIÊU trước khi nó chạm đỉnh.",
    "skills": [
      {
        "id": "evidence",
        "label": "Chụp bằng chứng",
        "icon": "📸",
        "key": "1",
        "hint": "Tin bịa đặt, vu khống: lưu lại làm bằng chứng"
      },
      {
        "id": "block",
        "label": "Chặn & Báo cáo",
        "icon": "🚫",
        "key": "2",
        "hint": "Một tài khoản lăng mạ, quấy rối cá nhân"
      },
      {
        "id": "lock",
        "label": "Khóa bình luận",
        "icon": "🔒",
        "key": "3",
        "hint": "Đám đông hùa theo, spam hàng loạt"
      },
      {
        "id": "help",
        "label": "Cầu cứu hỗ trợ",
        "icon": "🆘",
        "key": "4",
        "hint": "Đe dọa an toàn, lộ thông tin cá nhân"
      }
    ],
    "comments": [
      {
        "skill": "evidence",
        "author": "Gia Khánh",
        "text": "Tao có bạn học cùng, nó nói Minh Anh đưa thầy 10 triệu đó, chắc chắn luôn.",
        "why": "Thông tin bịa đặt cần được chụp lại kèm thời gian làm bằng chứng gửi nhà trường."
      },
      {
        "skill": "block",
        "author": "Tuấn Kiệt",
        "text": "Mày nhìn lại bản thân đi, đồ giả tạo, nhìn phát ghét.",
        "why": "Một tài khoản lăng mạ trực tiếp: chặn để ngừng tiếp xúc và báo cáo vi phạm."
      },
      {
        "skill": "lock",
        "author": "Hội Hóng Hớt",
        "text": "=))))) lên thớt rồi kìa ae ơi vào xem đi",
        "why": "Đám đông kéo vào hùa theo: khóa bình luận để cắt dòng bão."
      },
      {
        "skill": "help",
        "author": "Ẩn danh 0912",
        "text": "Biết nhà mày rồi, tối nay ra cổng trọ mà xem.",
        "why": "Lời đe dọa an toàn: báo ngay người thân, nhà trường hoặc công an."
      },
      {
        "skill": "evidence",
        "author": "Trang Confession",
        "text": "Nghe đâu khoa đã đình chỉ học Minh Anh rồi, sắp bị đuổi luôn.",
        "why": "Tin đồn sai sự thật: chụp màn hình để có căn cứ yêu cầu gỡ bài và đính chính."
      },
      {
        "skill": "block",
        "author": "Hải Đăng",
        "text": "Loại như mày nghỉ học quách cho rồi, ở lớp chỉ tổ chật chỗ.",
        "why": "Quấy rối cá nhân: chặn và báo cáo tài khoản."
      },
      {
        "skill": "lock",
        "author": "Nhóm Chém Gió",
        "text": "Ae vào cmt dạo cho vui nào 🍿🍿🍿",
        "why": "Kêu gọi đám đông spam: khóa bình luận bài viết."
      },
      {
        "skill": "help",
        "author": "Người lạ",
        "text": "Ảnh nhà mày, số của bố mẹ mày tao có hết rồi nhé.",
        "why": "Bị lộ thông tin cá nhân và người thân: cần người lớn và cơ quan chức năng hỗ trợ."
      },
      {
        "skill": "evidence",
        "author": "Minh Tú",
        "text": "Có clip Minh Anh ra vào phòng thầy lúc nửa đêm, ai cần tao gửi.",
        "why": "Vu khống có chủ đích: lưu bằng chứng để xử lý theo quy định."
      },
      {
        "skill": "block",
        "author": "Khoa Nguyễn",
        "text": "Mặt dày thật, còn dám đăng story cười nữa à?",
        "why": "Một người liên tục công kích: chặn và báo cáo."
      },
      {
        "skill": "lock",
        "author": "Page Biến Căng",
        "text": "Tag hết bạn bè vào đây coi biến nè!!! 🔥🔥🔥",
        "why": "Bài viết đang bị lan truyền ồ ạt: khóa bình luận để hạ nhiệt."
      },
      {
        "skill": "help",
        "author": "Ẩn danh",
        "text": "Mày biến khỏi đời này đi thì mọi người mới vui.",
        "why": "Lời kích động tự hại vô cùng nguy hiểm: tìm người tin cậy và chuyên gia hỗ trợ ngay."
      },
      {
        "skill": "evidence",
        "author": "Lan Phương",
        "text": "Bạn cùng phòng nó kể nó còn trộm đồ nữa đó, cẩn thận.",
        "why": "Thêm một lời bịa đặt bôi nhọ: chụp lại để làm hồ sơ."
      },
      {
        "skill": "block",
        "author": "Văn Toàn",
        "text": "Đồ ngu, học hành gì tầm này mà đòi điểm cao.",
        "why": "Xúc phạm cá nhân: chặn và báo cáo."
      },
      {
        "skill": "lock",
        "author": "Hùa Theo Team",
        "text": "Ai cũng nói vậy thì chắc là đúng thôi 😂😂",
        "why": "Hiệu ứng đám đông: khóa bình luận để ngăn lan rộng."
      },
      {
        "skill": "help",
        "author": "Tài khoản ảo",
        "text": "Tao gửi ảnh mày cho cả khoa rồi, chờ mai lên trường nhé.",
        "why": "Bị đe dọa và phát tán ảnh: báo nhà trường, người thân để được bảo vệ."
      },
      {
        "skill": "evidence",
        "author": "Hóng Biến Fan",
        "text": "Giảng viên đó đã bị kỷ luật vì vụ của Minh Anh, có nguồn tin nội bộ.",
        "why": "Tin giả liên quan nhiều người: chụp bằng chứng để báo cáo."
      },
      {
        "skill": "block",
        "author": "Bé Na",
        "text": "Nhìn thôi đã muốn tát, đúng loại hai mặt.",
        "why": "Lời lẽ bạo lực từ một tài khoản: chặn ngay."
      },
      {
        "skill": "lock",
        "author": "Ae Thích Drama",
        "text": "Hóng phần 2!!! Ai có thêm biến thì thả vào đây",
        "why": "Bình luận dồn dập kéo thêm drama: khóa bình luận."
      },
      {
        "skill": "help",
        "author": "Số lạ",
        "text": "Tao đang đứng dưới khu trọ của mày đây.",
        "why": "Nguy cơ an toàn thực sự: gọi người thân, bảo vệ hoặc công an (113) ngay."
      }
    ]
  },
  "round3": {
    "name": "5 Giây Đảo Ngược",
    "badge": "Màn 3 · Về đích",
    "goal": "Văn hóa ứng xử & đồng cảm",
    "intro": "Bạn vào vai Hoàng Nam, bạn cùng lớp của Minh Anh. Mỗi lựa chọn của người chứng kiến có thể đảo ngược tất cả. Hãy giúp chỉ số Tinh thần của Minh Anh hồi lại.",
    "situations": [
      {
        "where": "Nhóm chat: K22 TRUYỀN THÔNG 🐧",
        "members": "48 thành viên",
        "messages": [
          {
            "author": "Đức Huy",
            "text": "Ae xem ảnh chế mới nóng hổi nè 🤣🤣",
            "image": "Ảnh mặt Minh Anh bị ghép vào nhân vật \"Thánh Gian Lận\""
          },
          {
            "author": "Kim Ngân",
            "text": "Haha ai làm mà khéo thế"
          },
          {
            "author": "Tuấn Kiệt",
            "text": "Share lên story luôn đi 😂"
          }
        ],
        "question": "Ảnh chế Minh Anh đang lan trong nhóm lớp. Bạn sẽ làm gì?",
        "options": [
          {
            "text": "Thả \"haha\" cho vui thôi, ai trong nhóm cũng làm vậy mà.",
            "hp": -15,
            "verdict": "Tiếp tay",
            "explain": "Một nút \"haha\" là một lần cổ vũ cho người chế ảnh. Người chứng kiến im lặng cười theo khiến bạo lực lan nhanh hơn."
          },
          {
            "text": "Nhắn riêng nhờ Huy gỡ ảnh, báo cáo ảnh với admin nhóm, rồi nhắn hỏi thăm Minh Anh.",
            "hp": 30,
            "verdict": "Người bảo vệ",
            "explain": "Bạn vừa chặn nguồn lan truyền, vừa cho Minh Anh biết họ không một mình. Đây là cách phản hồi tốt nhất."
          },
          {
            "text": "Không thả gì cả, lặng lẽ thoát khỏi đoạn chat.",
            "hp": 5,
            "verdict": "Đứng ngoài",
            "explain": "Không tiếp tay là tốt, nhưng ảnh vẫn tiếp tục lan. Im lặng chưa đủ để bảo vệ bạn mình."
          }
        ]
      },
      {
        "where": "Nhóm chat: K22 TRUYỀN THÔNG 🐧",
        "members": "48 thành viên",
        "messages": [
          {
            "author": "Trang Confession",
            "text": "Nghe nói khoa đình chỉ Minh Anh rồi đó mọi người"
          },
          {
            "author": "Lan Phương",
            "text": "Thật hả? Vậy là đúng nó gian lận rồi"
          },
          {
            "author": "Kim Ngân",
            "text": "Ai có link thông báo không, cho xin với"
          }
        ],
        "question": "Tin đồn \"bị đình chỉ\" đang lan trong nhóm lớp. Bạn phản hồi thế nào?",
        "options": [
          {
            "text": "Chuyển tiếp tin này sang nhóm khác để mọi người cùng biết mà cảnh giác.",
            "hp": -15,
            "verdict": "Lan truyền tin giả",
            "explain": "Chia sẻ tin chưa kiểm chứng là góp tay vào vụ bóc phốt. Mỗi lượt chuyển tiếp là thêm một vết thương."
          },
          {
            "text": "Hỏi lại Trang: \"Nguồn ở đâu vậy? Chưa rõ thì đừng nói vậy nhé.\"",
            "hp": 15,
            "verdict": "Tỉnh táo",
            "explain": "Đặt câu hỏi về nguồn tin giúp cả nhóm chậm lại. Tốt, nhưng có thể làm nhiều hơn."
          },
          {
            "text": "Đăng trong nhóm: \"Mình đã hỏi cô cố vấn, khoa chưa có kết luận nào và điểm thi lại có biên bản. Mọi người dừng lan truyền nhé.\"",
            "hp": 30,
            "verdict": "Người đính chính",
            "explain": "Bạn kiểm chứng từ nguồn chính thống và công khai sự thật. Đính chính kịp thời là cách mạnh nhất để chặn tin đồn."
          }
        ]
      },
      {
        "where": "Tin nhắn riêng: Minh Anh",
        "members": "Đang hoạt động",
        "messages": [
          {
            "author": "Minh Anh",
            "text": "Nam ơi…"
          },
          {
            "author": "Minh Anh",
            "text": "Mình mệt quá. Mình không muốn đi học nữa, cũng không muốn gặp ai hết."
          }
        ],
        "question": "Minh Anh nhắn riêng cho bạn lúc nửa đêm. Bạn trả lời thế nào?",
        "options": [
          {
            "text": "\"Mình ở đây với bạn. Bạn không có lỗi. Mai mình đi cùng bạn gặp cô cố vấn và phòng Công tác sinh viên nhé. Cần gì cứ gọi mình, lúc nào cũng được.\"",
            "hp": 40,
            "verdict": "Điểm tựa",
            "explain": "Lắng nghe, khẳng định họ không có lỗi, và đồng hành tìm sự hỗ trợ từ người lớn, nhà trường. Đây là điều người bị bạo lực mạng cần nhất."
          },
          {
            "text": "\"Lên mạng chửi lại tụi nó đi, im lặng là tụi nó lấn tới đó!\"",
            "hp": -15,
            "verdict": "Đổ thêm dầu",
            "explain": "Đáp trả bằng lời lẽ gay gắt dễ khiến cơn bão lớn hơn và Minh Anh bị tổn thương thêm."
          },
          {
            "text": "\"Kệ đi, vài hôm là người ta quên thôi. Ngủ sớm đi.\"",
            "hp": -5,
            "verdict": "Gạt đi",
            "explain": "Lời khuyên vô tình xem nhẹ cảm xúc của bạn mình. Người đang tổn thương cần được lắng nghe, không phải được bảo \"kệ đi\"."
          }
        ]
      }
    ]
  },
  "endings": {
    "fail": {
      "title": "Chỉ số Tinh thần đã về 0",
      "lead": "Đằng sau màn hình là một con người thật.",
      "points": [
        "Lo âu, mất ngủ, sợ mở điện thoại mỗi khi có thông báo.",
        "Tự cô lập, bỏ học, xa lánh bạn bè và gia đình.",
        "Trầm cảm và cả những ý nghĩ tự làm hại bản thân."
      ],
      "help": "Nếu bạn hoặc người quen đang bị bạo lực mạng: hãy nói với người thân, thầy cô, phòng Công tác sinh viên. Trẻ em và người dưới 18 tuổi có thể gọi Tổng đài quốc gia bảo vệ trẻ em 111 (miễn phí, 24/7). Khi bị đe dọa an toàn, gọi công an 113.",
      "cta": "Vào vai người chứng kiến, cứu lấy Minh Anh"
    },
    "win": {
      "title": "Lá chắn đã giữ vững!",
      "lead": "Minh Anh không phải đi qua cơn bão một mình.",
      "points": [
        "Nhận diện đúng bạo lực mạng là bước đầu để không tiếp tay.",
        "Bằng chứng, chặn, khóa và cầu cứu: tự vệ có kỹ năng.",
        "Một người chứng kiến lên tiếng có thể đảo ngược cả câu chuyện."
      ]
    },
    "lose": {
      "title": "Minh Anh vẫn còn tổn thương",
      "lead": "Cơn bão đã qua, nhưng vết thương thì chưa lành.",
      "points": [
        "Im lặng và cười theo cũng là một cách tham gia.",
        "Hãy kiểm chứng trước khi tin, suy nghĩ trước khi gửi.",
        "Lần sau, hãy là người đầu tiên lên tiếng bảo vệ."
      ]
    },
    "scene": {
      "chatTitle": "Nhóm chat: K22 TRUYỀN THÔNG 🐧",
      "lastMessages": [
        "Mọi người ơi…",
        "Mình không làm chuyện đó. Thật mà.",
        "Có ai tin mình không?"
      ],
      "seen": "Đã xem bởi 47 người",
      "noReply": "Không ai trả lời.",
      "morning": "Sáng hôm sau",
      "classTitle": "Lớp K22 Truyền thông · Tiết 1",
      "rollCall": "Cô giáo điểm danh: \"Minh Anh?\"",
      "silence": "…",
      "emptySeat": "Chỗ ngồi cạnh cửa sổ bỏ trống.",
      "after": [
        "Ngày hôm sau cũng vậy.",
        "Những bình luận vẫn còn đó. Người viết đã quên từ lâu, nhưng Minh Anh thì không."
      ],
      "question": "Nếu có một người lên tiếng sớm hơn…"
    },
    "goodScene": {
      "chatTitle": "Nhóm chat: K22 TRUYỀN THÔNG 🐧",
      "messages": [
        {
          "author": "Minh Anh",
          "text": "Cảm ơn mọi người đã tin mình 🥹"
        },
        {
          "author": "Hoàng Nam",
          "text": "Bọn mình luôn ở đây mà! Mai đi học nhé 💪"
        },
        {
          "author": "Trà My",
          "text": "Mai mình mang bánh mì cho cậu 🥖"
        },
        {
          "author": "Quốc Bảo",
          "text": "Page kia gỡ bài và đính chính rồi đó ❤️"
        }
      ],
      "morning": "Sáng hôm sau",
      "classTitle": "Lớp K22 Truyền thông · Tiết 1",
      "board": "Sĩ số: 16 · Có mặt: 16",
      "rollCall": "Cô giáo điểm danh: \"Minh Anh?\"",
      "answer": "\"Dạ, có ạ!\" 😄",
      "bubbles": [
        {
          "who": "Minh Anh",
          "text": "Chào cả lớp! 😄"
        },
        {
          "who": "Hoàng Nam",
          "text": "Chào Minh Anh! 👋"
        },
        {
          "who": "Trà My",
          "text": "Bánh mì của cậu nè 🥖"
        },
        {
          "who": "Quốc Bảo",
          "text": "Trưa nay đi ăn chè không? 🍧"
        },
        {
          "who": "Minh Anh",
          "text": "Đi chứ! 🥰"
        }
      ],
      "closing": "Minh Anh lại cười, lại nói chuyện rôm rả với cả lớp như chưa từng có cơn bão nào.",
      "lesson": "Chỉ cần một người lên tiếng đúng lúc, câu chuyện đã khác."
    },
    "consequences": {
      "title": "Hậu quả của bạo lực mạng",
      "victimTitle": "Với người bị bắt nạt",
      "victim": [
        "Lo âu, mất ngủ, sợ mở điện thoại mỗi khi có thông báo.",
        "Tự cô lập, bỏ học, xa lánh bạn bè và gia đình.",
        "Trầm cảm, tổn thương tinh thần kéo dài nhiều năm."
      ],
      "bullyTitle": "Với người bắt nạt và người hùa theo",
      "bully": [
        "Vu khống, làm nhục người khác có thể bị xử phạt hành chính hoặc truy cứu trách nhiệm hình sự (Bộ luật Hình sự, Điều 155 và 156).",
        "Tung địa chỉ, số điện thoại của người khác là vi phạm quy định bảo vệ dữ liệu cá nhân.",
        "Bình luận đã gửi có thể bị chụp lại và tồn tại mãi trên mạng."
      ],
      "helpTitle": "Bạn không một mình",
      "help": "Nếu bạn đang thấy mệt mỏi như Minh Anh, hãy nói với một người bạn tin tưởng, thầy cô hoặc gia đình. Thấy bạn mình bị bắt nạt, hãy lên tiếng và ở bên bạn ấy.",
      "hotline": "111",
      "hotlineLabel": "Tổng đài quốc gia bảo vệ trẻ em · miễn phí · 24/7",
      "police": "Bị đe dọa an toàn: gọi công an 113"
    }
  }
};
