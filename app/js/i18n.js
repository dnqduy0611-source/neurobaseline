/* NeuroBaseline – interface text. English and Vietnamese now; add a language by adding one block
   (for Arabic also set dir: 'rtl'). Machine-translated text must be reviewed by a native speaker. */
(function () {
  'use strict';
  var NB = window.NB;
  var D = {};

  D.en = {
    'app.tag': 'Screening tool — not a diagnosis',
    'btn.continue': 'Continue', 'btn.start': 'Start', 'btn.back': 'Back', 'btn.home': 'Back to home', 'btn.yes': 'Yes', 'btn.no': 'No',

    'intro.title': 'Welcome',
    'intro.lead': 'NeuroBaseline follows your thinking speed, attention and memory over time, and compares you with <b>yourself</b>, not with other people.',
    'intro.b1': 'Each session takes about 5 minutes.',
    'intro.b2': 'In the first 2 weeks you do 5 short sessions. They show the app your usual level.',
    'intro.b3': 'After that, one session a month is enough.',
    'intro.note': 'This is a screening and monitoring tool. It cannot diagnose any condition.',

    'consent.title': 'Before you start',
    'consent.body': '<li>This is a pilot of short cognitive tests. It checks whether the tests are reliable and easy to use.</li><li>It is not a medical test and gives no diagnosis.</li><li>The tests ask only your age group, education level and writing hand. No name, no health records.</li><li>A separate risk profile asks about health and lifestyle. It is optional and you can skip it.</li><li>Your results stay on this device. Nothing is uploaded. You decide whether to export your file and send it to the study team.</li><li>You are identified only by a random code.</li><li>You can stop at any time and delete your data in Settings.</li>',
    'consent.check': 'I am 18 or older and I agree to take part.',

    'profile.title': 'About you',
    'profile.code': 'Your anonymous code',
    'profile.age': 'Age group', 'profile.edu': 'Highest education', 'profile.hand': 'Writing hand',
    'edu.1': 'Primary school or less', 'edu.2': 'Secondary school', 'edu.3': 'College / university', 'edu.4': 'Postgraduate',
    'hand.R': 'Right', 'hand.L': 'Left', 'profile.pick': 'Choose…',

    'home.next': 'Next session', 'home.dueNow': 'Ready now', 'home.dueIn': 'in {n} day(s) · {date}',
    'home.start': 'Start session', 'home.history': 'History', 'home.settings': 'Settings',
    'home.tooSoon': 'Your last session was less than 12 hours ago. Sessions work best 2–3 days apart. Start anyway?',
    'home.demo': 'DEMO PROFILE — SIMULATED DATA (not a real person)',
    'home.chart': 'Your results over time', 'home.tip': 'Tip: do your sessions at about the same time of day, on the same phone.',
    'home.nosave': 'This browser is not saving data (private mode?). Results would be lost.',

    'st.new.t': 'Let’s find your usual level', 'st.new.x': 'Your first session is a warm-up. It lets you get used to the tasks.',
    'st.building.t': 'Finding your usual level: {done} of {total} sessions', 'st.building.x': 'Results are not judged yet. After session {total} the app knows your usual range.',
    'st.ready.t': 'Your usual level is set', 'st.ready.x': 'From now on each session is compared with your own usual range.',
    'st.green.t': 'Stable', 'st.green.x': 'Your latest results are within your own usual range.',
    'st.yellow.t': 'Please repeat in 2 weeks', 'st.yellow.x': 'Something in your recent results is worth a second look. This often has everyday causes such as poor sleep, illness or stress. A repeat session will show whether it lasts.',
    'st.red.t': 'Clinical review advised', 'st.red.x': 'A change from your usual level was confirmed. This is not a diagnosis. Please share your summary with a doctor, who decides what to do next.',
    'st.ctx': 'You reported poor sleep, feeling unwell, low mood or a change of medicine for this session. That may explain the result.',
    'why.title': 'Why', 'why.line': '{name}: {v} (your usual level {base}, limit {lim})',
    'why.first': 'Outside your usual range for the first time.', 'why.confirmed': 'Still outside your usual range on the repeat session.', 'why.multi': 'Two or more areas changed in the same session.',
    'why.trend': 'Your results have been slowly declining for about {n} month(s): {names}.',
    'why.trendWatch': 'Your results may be starting to decline ({names}). A repeat session will help to tell.',

    'ind.rt': 'Reaction time', 'ind.sdmt': 'Symbol matching', 'ind.mem': 'Picture memory', 'ind.gng': 'Wrong taps (Stop task)',
    'ind.rt.d': 'milliseconds · lower is faster', 'ind.sdmt.d': 'correct in 90 s · higher is better', 'ind.mem.d': 'score from −8 to 8 · higher is better', 'ind.gng.d': '% taps on red · lower is better',

    'rf.title': 'Safety check', 'rf.lead': 'In the last few days, has any of these appeared <b>suddenly</b>?',
    'rf.1': 'Weakness or numbness on one side of the body, or a drooping face', 'rf.2': 'Trouble speaking or understanding speech',
    'rf.3': 'A new, very severe headache', 'rf.4': 'Sudden confusion, or confusion with fever',
    'rf.none': 'None of these', 'rf.some': 'Yes, one or more',
    'em.title': 'Please get medical help now', 'em.body': 'These symptoms can be an emergency. Call your local emergency number or go to the nearest emergency department now. Do not wait for a test.',
    'em.note': 'This app cannot assess emergencies. No session was started.',

    'ctx.title': 'Today', 'ctx.sleep': 'How did you sleep last night?', 'ctx.sleep.poor': 'Badly', 'ctx.sleep.ok': 'OK', 'ctx.sleep.good': 'Well',
    'ctx.sleepH': 'About how many hours did you sleep last night?', 'ctx.sleepH.lt5': 'Under 5 hours', 'ctx.sleepH.5': 'About 5 hours', 'ctx.sleepH.6': 'About 6 hours', 'ctx.sleepH.7': 'About 7 hours', 'ctx.sleepH.8plus': '8 hours or more',
    'ctx.unwell': 'Are you ill today (fever, pain, flu)?', 'ctx.mood': 'How is your mood today?', 'ctx.mood.low': 'Low', 'ctx.mood.ok': 'OK', 'ctx.mood.good': 'Good',
    'ctx.med': 'Any new or changed medicine in the last week?', 'ctx.setup': 'Put the phone flat on a table. Use the index finger of your writing hand. Find a quiet place.',

    'run.part': 'Part {k} of {n}', 'run.interrupted.t': 'Task interrupted', 'run.interrupted.x': 'The screen was hidden during the task, so this part must be repeated.',
    'run.retry': 'Repeat this part', 'run.quit': 'Stop the session', 'run.practice': 'Practice', 'run.practiceGo': 'Try it', 'run.real.t': 'Now the real one', 'run.real.x': 'No more feedback on screen. Do your best.',
    'run.saving': 'Saving…',

    'mem1.t': 'Remember the pictures', 'mem1.x': 'You will see {n} pictures, one at a time. Just look and remember them. You will be asked about them at the end of the session.',
    'rt.t': 'Reaction time', 'rt.x': 'A blue circle will appear. Tap the screen as fast as you can when you see it. Do not tap before it appears.',
    'rt.early': 'Too early — wait for the circle', 'rt.miss': 'A little slow',
    'gng.t': 'Go / Stop', 'gng.x': '<b>Green circle</b>: tap as fast as you can.<br><b>Red square</b>: do NOT tap.',
    'gng.ok': 'Correct', 'gng.fa': 'That was red — do not tap', 'gng.miss': 'A little slow — tap when you see green',
    'sdmt.t': 'Symbol matching', 'sdmt.x': 'Each symbol has a number, shown in the key at the top. Look at the big symbol and tap its number. Go as fast as you can without mistakes, for 90 seconds.',
    'sdmt.ok': 'Correct', 'sdmt.bad': 'The right number was {d}',
    'mem2.t': 'Which pictures did you see?', 'mem2.x': 'You will see pictures one at a time. Some were shown at the start of the session, some are new. Answer for each one.',
    'mem.q': 'Did you see this picture at the start?', 'mem.seen': 'Yes, seen', 'mem.notseen': 'No, new',
    'ctl.t': 'Known-change check', 'ctl.x': 'This extra run uses your <b>other hand</b> (not your writing hand). It is expected to be a little slower. It checks that the app can detect a change that we know is there.',

    'res.title': 'Session complete', 'res.thanks': 'Thank you.', 'res.within': 'within your usual range', 'res.worse': 'outside your usual range', 'res.better': 'better than usual',
    'res.nobase': 'still learning your usual level', 'res.warm': 'warm-up session',
    'res.ctl.t': 'Known-change check', 'res.ctl.yes': 'Detected: the other-hand run was outside your usual range.', 'res.ctl.no': 'Not detected: the other-hand run stayed within your usual range.',
    'res.ctl.need': 'Please complete your first 5 sessions before this check.',
    'res.disclaimer': 'These results are for screening and monitoring only. They are not a diagnosis. If you are worried about your memory or thinking, talk to a doctor.',

    'hist.title': 'History', 'hist.date': 'Date', 'hist.none': 'No sessions yet.',
    'role.familiarization': 'Warm-up', 'role.baseline': 'Usual level', 'role.followup': 'Follow-up', 'role.control': 'Other hand', 'role.excluded': 'Not counted',
    'lg.fam': 'warm-up', 'lg.base': 'usual level', 'lg.fu': 'follow-up', 'lg.out': 'outside range', 'lg.ctl': 'other hand', 'lg.flag': 'hollow = unusual day', 'lg.band': 'your usual range',

    'set.title': 'Settings', 'set.lang': 'Language',
    'set.export.t': 'Your data', 'set.export.x': 'Your results are stored only on this device. To take part in the pilot, export your file and send it to the study team.',
    'set.download': 'Download file', 'set.share': 'Share file', 'set.copy': 'Copy as text', 'set.copied': 'Copied',
    'set.pilot.t': 'Pilot tools', 'set.ctl': 'Run the other-hand check', 'set.ctl.x': 'Two short tasks with your non-writing hand (about 3 minutes). Do it after your 5th session.',
    'set.demo.t': 'Demo profile', 'set.demo.x': 'Shows 10 months of simulated history for a fictional person. Your own data is kept separately and is not changed.',
    'set.demo.on': 'Open demo profile', 'set.demo.off': 'Leave demo profile',
    'set.reset': 'Delete all my data on this device', 'set.reset.q': 'Delete all sessions and your profile from this device? This cannot be undone.',
    'set.about': 'NeuroBaseline {v} · research prototype · not a medical device'
  };

  D.vi = {
    'app.tag': 'Công cụ sàng lọc — không phải chẩn đoán',
    'btn.continue': 'Tiếp tục', 'btn.start': 'Bắt đầu', 'btn.back': 'Quay lại', 'btn.home': 'Về trang chính', 'btn.yes': 'Có', 'btn.no': 'Không',

    'intro.title': 'Xin chào',
    'intro.lead': 'NeuroBaseline theo dõi tốc độ xử lý, sự chú ý và trí nhớ của bạn theo thời gian, và so bạn với <b>chính bạn</b>, không so với người khác.',
    'intro.b1': 'Mỗi buổi mất khoảng 5 phút.',
    'intro.b2': 'Trong 2 tuần đầu bạn làm 5 buổi ngắn. Các buổi này giúp app biết mức thường ngày của riêng bạn.',
    'intro.b3': 'Sau đó mỗi tháng một buổi là đủ.',
    'intro.note': 'Đây là công cụ sàng lọc và theo dõi. Nó không chẩn đoán được bệnh nào.',

    'consent.title': 'Trước khi bắt đầu',
    'consent.body': '<li>Đây là đợt thử nghiệm các bài test nhận thức ngắn, để xem test có ổn định và dễ dùng không.</li><li>Đây không phải xét nghiệm y khoa và không đưa ra chẩn đoán.</li><li>Phần test chỉ hỏi nhóm tuổi, học vấn và tay thuận. Không hỏi tên, không hỏi bệnh án.</li><li>Có một phần hồ sơ nguy cơ riêng, hỏi về sức khỏe và lối sống. Phần này tùy chọn, bạn có thể bỏ qua.</li><li>Kết quả nằm trên máy này. Không có gì được tải lên. Bạn tự quyết định có xuất file và gửi cho nhóm nghiên cứu hay không.</li><li>Bạn chỉ được nhận diện bằng một mã ngẫu nhiên.</li><li>Bạn có thể dừng bất cứ lúc nào và xóa dữ liệu trong phần Cài đặt.</li>',
    'consent.check': 'Tôi từ 18 tuổi trở lên và đồng ý tham gia.',

    'profile.title': 'Về bạn',
    'profile.code': 'Mã ẩn danh của bạn',
    'profile.age': 'Nhóm tuổi', 'profile.edu': 'Học vấn cao nhất', 'profile.hand': 'Tay thuận (tay viết)',
    'edu.1': 'Tiểu học trở xuống', 'edu.2': 'Trung học', 'edu.3': 'Cao đẳng / đại học', 'edu.4': 'Sau đại học',
    'hand.R': 'Phải', 'hand.L': 'Trái', 'profile.pick': 'Chọn…',

    'home.next': 'Buổi tiếp theo', 'home.dueNow': 'Làm được ngay', 'home.dueIn': 'sau {n} ngày · {date}',
    'home.start': 'Bắt đầu buổi test', 'home.history': 'Lịch sử', 'home.settings': 'Cài đặt',
    'home.tooSoon': 'Buổi trước của bạn cách đây chưa tới 12 giờ. Các buổi nên cách nhau 2–3 ngày. Vẫn làm bây giờ?',
    'home.demo': 'HỒ SƠ DEMO — DỮ LIỆU MÔ PHỎNG (không phải người thật)',
    'home.chart': 'Kết quả của bạn theo thời gian', 'home.tip': 'Mẹo: làm test vào cùng khung giờ trong ngày, trên cùng một điện thoại.',
    'home.nosave': 'Trình duyệt này không lưu được dữ liệu (đang ở chế độ ẩn danh?). Kết quả sẽ bị mất.',

    'st.new.t': 'Cùng tìm mức thường ngày của bạn', 'st.new.x': 'Buổi đầu tiên là buổi làm quen, để bạn quen với các bài test.',
    'st.building.t': 'Đang ghi nhận mức thường ngày của bạn: {done} / {total} buổi', 'st.building.x': 'Kết quả chưa được đánh giá. Sau buổi thứ {total}, app biết khoảng bình thường của bạn.',
    'st.ready.t': 'Đã ghi nhận mức thường ngày của bạn', 'st.ready.x': 'Từ giờ mỗi buổi sẽ được so với khoảng bình thường của chính bạn.',
    'st.green.t': 'Ổn định', 'st.green.x': 'Kết quả mới nhất nằm trong khoảng bình thường của chính bạn.',
    'st.yellow.t': 'Hãy làm lại sau 2 tuần', 'st.yellow.x': 'Kết quả gần đây của bạn có điểm cần xem lại. Việc này thường do những lý do hằng ngày như ngủ kém, ốm hoặc căng thẳng. Buổi làm lại sẽ cho biết thay đổi có kéo dài hay không.',
    'st.red.t': 'Nên đi khám', 'st.red.x': 'Một thay đổi so với mức thường ngày của bạn đã được xác nhận. Đây không phải chẩn đoán. Hãy đưa bản tóm tắt cho bác sĩ; bác sĩ sẽ quyết định bước tiếp theo.',
    'st.ctx': 'Buổi này bạn báo ngủ kém, đang ốm, tâm trạng thấp hoặc mới đổi thuốc. Điều đó có thể giải thích kết quả.',
    'why.title': 'Vì sao', 'why.line': '{name}: {v} (mức thường ngày của bạn {base}, giới hạn {lim})',
    'why.first': 'Lần đầu nằm ngoài khoảng bình thường.', 'why.confirmed': 'Buổi làm lại vẫn nằm ngoài khoảng bình thường.', 'why.multi': 'Hai lĩnh vực trở lên thay đổi trong cùng một buổi.',
    'why.trend': 'Kết quả của bạn có xu hướng kém đi trong khoảng {n} tháng gần đây: {names}.',
    'why.trendWatch': 'Kết quả của bạn có dấu hiệu bắt đầu kém đi ({names}). Buổi làm lại sẽ giúp xác định rõ hơn.',

    'ind.rt': 'Thời gian phản ứng', 'ind.sdmt': 'Ghép ký hiệu', 'ind.mem': 'Nhớ hình', 'ind.gng': 'Chạm nhầm (bài Dừng)',
    'ind.rt.d': 'mili giây · thấp là nhanh', 'ind.sdmt.d': 'số câu đúng trong 90 giây · cao là tốt', 'ind.mem.d': 'điểm từ −8 đến 8 · cao là tốt', 'ind.gng.d': '% chạm vào hình đỏ · thấp là tốt',

    'rf.title': 'Kiểm tra an toàn', 'rf.lead': 'Trong vài ngày qua, bạn có <b>đột ngột</b> bị dấu hiệu nào dưới đây không?',
    'rf.1': 'Yếu hoặc tê một bên người, hoặc méo miệng', 'rf.2': 'Khó nói hoặc khó hiểu lời người khác',
    'rf.3': 'Đau đầu dữ dội mới xuất hiện', 'rf.4': 'Lú lẫn đột ngột, hoặc lú lẫn kèm sốt',
    'rf.none': 'Không có dấu hiệu nào', 'rf.some': 'Có ít nhất một dấu hiệu',
    'em.title': 'Hãy đi khám ngay', 'em.body': 'Các dấu hiệu này có thể là cấp cứu. Hãy gọi số cấp cứu nơi bạn ở hoặc đến khoa cấp cứu gần nhất ngay bây giờ. Đừng chờ làm test.',
    'em.note': 'App này không đánh giá được tình huống cấp cứu. Buổi test chưa được bắt đầu.',

    'ctx.title': 'Hôm nay', 'ctx.sleep': 'Đêm qua bạn ngủ thế nào?', 'ctx.sleep.poor': 'Kém', 'ctx.sleep.ok': 'Tạm', 'ctx.sleep.good': 'Ngon',
    'ctx.sleepH': 'Đêm qua bạn ngủ khoảng mấy tiếng?', 'ctx.sleepH.lt5': 'Dưới 5 tiếng', 'ctx.sleepH.5': 'Khoảng 5 tiếng', 'ctx.sleepH.6': 'Khoảng 6 tiếng', 'ctx.sleepH.7': 'Khoảng 7 tiếng', 'ctx.sleepH.8plus': 'Từ 8 tiếng trở lên',
    'ctx.unwell': 'Hôm nay bạn có ốm không (sốt, đau, cảm cúm)?', 'ctx.mood': 'Tâm trạng hôm nay?', 'ctx.mood.low': 'Thấp', 'ctx.mood.ok': 'Bình thường', 'ctx.mood.good': 'Tốt',
    'ctx.med': 'Tuần qua bạn có dùng thuốc mới hoặc đổi thuốc không?', 'ctx.setup': 'Đặt điện thoại nằm trên bàn. Dùng ngón trỏ của tay thuận. Chọn chỗ yên tĩnh.',

    'run.part': 'Phần {k} / {n}', 'run.interrupted.t': 'Bài test bị gián đoạn', 'run.interrupted.x': 'Màn hình đã bị ẩn trong lúc làm, nên phần này phải làm lại.',
    'run.retry': 'Làm lại phần này', 'run.quit': 'Dừng buổi test', 'run.practice': 'Làm thử', 'run.practiceGo': 'Làm thử', 'run.real.t': 'Bây giờ là bài thật', 'run.real.x': 'Màn hình sẽ không báo đúng sai nữa. Hãy cố gắng hết sức.',
    'run.saving': 'Đang lưu…',

    'mem1.t': 'Hãy nhớ các hình', 'mem1.x': 'Bạn sẽ thấy {n} hình, mỗi lần một hình. Chỉ cần nhìn và nhớ. Cuối buổi bạn sẽ được hỏi lại.',
    'rt.t': 'Thời gian phản ứng', 'rt.x': 'Một hình tròn xanh sẽ hiện ra. Thấy nó thì chạm màn hình thật nhanh. Đừng chạm trước khi nó hiện.',
    'rt.early': 'Hơi sớm — bạn hãy đợi hình tròn hiện ra', 'rt.miss': 'Hơi chậm',
    'gng.t': 'Chạm / Dừng', 'gng.x': '<b>Hình tròn xanh lá</b>: chạm thật nhanh.<br><b>Hình vuông đỏ</b>: KHÔNG chạm.',
    'gng.ok': 'Đúng', 'gng.fa': 'Đó là hình đỏ — bạn không cần chạm', 'gng.miss': 'Hơi chậm — thấy hình xanh thì bạn chạm ngay',
    'sdmt.t': 'Ghép ký hiệu', 'sdmt.x': 'Mỗi ký hiệu ứng với một số, xem bảng ở phía trên. Nhìn ký hiệu lớn rồi chạm vào số của nó. Làm nhanh nhất có thể mà không sai, trong 90 giây.',
    'sdmt.ok': 'Đúng', 'sdmt.bad': 'Số đúng là {d}',
    'mem2.t': 'Bạn đã thấy hình nào?', 'mem2.x': 'Các hình sẽ hiện từng cái một. Có hình đã xuất hiện ở đầu buổi, có hình mới. Hãy trả lời cho từng hình.',
    'mem.q': 'Bạn có thấy hình này ở đầu buổi không?', 'mem.seen': 'Có, đã thấy', 'mem.notseen': 'Không, hình mới',
    'ctl.t': 'Kiểm tra thay đổi biết trước', 'ctl.x': 'Lượt làm thêm này dùng <b>tay còn lại</b> (không phải tay thuận). Dự kiến sẽ chậm hơn một chút. Mục đích là xem app có bắt được một thay đổi mà ta biết chắc là có hay không.',

    'res.title': 'Xong buổi test', 'res.thanks': 'Cảm ơn bạn.', 'res.within': 'trong khoảng bình thường', 'res.worse': 'ngoài khoảng bình thường', 'res.better': 'tốt hơn thường lệ',
    'res.nobase': 'đang ghi nhận mức thường ngày', 'res.warm': 'buổi làm quen',
    'res.ctl.t': 'Kiểm tra thay đổi biết trước', 'res.ctl.yes': 'Bắt được: lượt tay còn lại nằm ngoài khoảng bình thường của bạn.', 'res.ctl.no': 'Không bắt được: lượt tay còn lại vẫn nằm trong khoảng bình thường.',
    'res.ctl.need': 'Bạn cần làm xong 5 buổi đầu trước khi làm phần này.',
    'res.disclaimer': 'Kết quả chỉ dùng để sàng lọc và theo dõi, không phải chẩn đoán. Nếu bạn lo về trí nhớ hay khả năng suy nghĩ của mình, hãy gặp bác sĩ.',

    'hist.title': 'Lịch sử', 'hist.date': 'Ngày', 'hist.none': 'Chưa có buổi nào.',
    'role.familiarization': 'Làm quen', 'role.baseline': 'Mức thường ngày', 'role.followup': 'Theo dõi', 'role.control': 'Tay còn lại', 'role.excluded': 'Không tính',
    'lg.fam': 'làm quen', 'lg.base': 'mức thường ngày', 'lg.fu': 'theo dõi', 'lg.out': 'ngoài khoảng', 'lg.ctl': 'tay còn lại', 'lg.flag': 'rỗng = ngày bất thường', 'lg.band': 'khoảng bình thường của bạn',

    'set.title': 'Cài đặt', 'set.lang': 'Ngôn ngữ',
    'set.export.t': 'Dữ liệu của bạn', 'set.export.x': 'Kết quả chỉ lưu trên máy này. Để tham gia đợt thử nghiệm, hãy xuất file và gửi cho nhóm nghiên cứu.',
    'set.download': 'Tải file về', 'set.share': 'Chia sẻ file', 'set.copy': 'Sao chép dạng chữ', 'set.copied': 'Đã sao chép',
    'set.pilot.t': 'Công cụ thử nghiệm', 'set.ctl': 'Làm lượt kiểm tra tay còn lại', 'set.ctl.x': 'Hai bài ngắn bằng tay không thuận (khoảng 3 phút). Làm sau buổi thứ 5.',
    'set.demo.t': 'Hồ sơ demo', 'set.demo.x': 'Hiện 10 tháng lịch sử mô phỏng của một nhân vật hư cấu. Dữ liệu thật của bạn được giữ riêng và không bị thay đổi.',
    'set.demo.on': 'Mở hồ sơ demo', 'set.demo.off': 'Thoát hồ sơ demo',
    'set.reset': 'Xóa toàn bộ dữ liệu của tôi trên máy này', 'set.reset.q': 'Xóa mọi buổi test và hồ sơ khỏi máy này? Không khôi phục được.',
    'set.about': 'NeuroBaseline {v} · bản thử nghiệm nghiên cứu · không phải thiết bị y tế'
  };

  var I = {
    lang: 'en', langs: [['en', 'English'], ['vi', 'Tiếng Việt']],
    add: function (l, obj) { D[l] = D[l] || {}; Object.keys(obj).forEach(function (k) { D[l][k] = obj[k]; }); }, // extra text from other files
    set: function (l) { I.lang = D[l] ? l : 'en'; document.documentElement.lang = I.lang; document.documentElement.dir = D[I.lang].dir || 'ltr'; },
    t: function (k, vars) {
      var s = (D[I.lang] && D[I.lang][k]) || D.en[k] || k;
      if (vars) Object.keys(vars).forEach(function (n) { s = s.split('{' + n + '}').join(vars[n]); });
      return s;
    }
  };
  NB.i18n = I;
})();
