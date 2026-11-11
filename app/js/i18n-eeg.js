/* NeuroBaseline – text for the optional brain-rhythm check (resting EEG from a headband). English and Vietnamese.
   Participant wording is plain; the clinician wording (c.eeg.*) uses the technical terms. */
(function () {
  'use strict';
  var I = window.NB.i18n;

  I.add('en', {
    'eeg.card.t': 'Brain-rhythm check (optional)',
    'eeg.card.none': 'If you have an EEG headband, a 3-minute recording at rest adds a second view that does not depend on language or schooling.',
    'eeg.card.done': '{n} recording(s) saved · last on {date}', 'eeg.card.open': 'Open',
    'eeg.t': 'Brain-rhythm check',
    'eeg.lead': 'At rest with eyes closed, the brain produces a steady rhythm of about 10 waves a second, called the alpha rhythm. The app follows how strong and how fast your own rhythm is over time.',
    'eeg.how.t': 'How to record', 'eeg.how.1': 'Sit comfortably in a quiet place and put the headband on.', 'eeg.how.2': 'Close your eyes and stay still for 3 minutes.', 'eeg.how.3': 'Save the recording as a CSV file with the headband’s app, then choose that file here.',
    'eeg.pick': 'Choose a recording file', 'eeg.try.t': 'No headband? See how it works',
    'eeg.try.x': 'These sample recordings come from a public research dataset, adapted to look like headband recordings. They are not yours and are not saved.',
    'eeg.sample.CN': 'Sample: healthy adult', 'eeg.sample.AD': 'Sample: person with Alzheimer’s disease', 'eeg.sample.FTD': 'Sample: person with frontotemporal dementia',
    'eeg.live': 'Simulated headband (live view)', 'eeg.live.x': 'Plays a sample recording as if a headband were streaming it, 30 times faster than real time.',
    'eeg.busy': 'Analysing the recording…', 'eeg.reading': 'Reading the file…',
    'eeg.rate.t': 'How many samples per second?', 'eeg.rate.x': 'The file has no usable time column. Choose the sampling rate of your headband (see its manual).',
    'eeg.err.empty': 'This file is empty or too short.', 'eeg.err.noheader': 'The first line of the file must name the channels.', 'eeg.err.nochannels': 'No EEG channels were found in this file (for example TP9, AF7, O1).',
    'eeg.err.rate': 'This sampling rate is not supported yet.', 'eeg.err.big': 'This file is too large.', 'eeg.err.load': 'The sample could not be loaded.',
    'eeg.res.t': 'Your recording', 'eeg.res.sample': 'Sample recording', 'eeg.src': '{label}. Source: {source}, public research data. Not saved.',
    'eeg.q.good': 'Recording quality: good. {kept} of {n} segments were clean.', 'eeg.q.bad': 'Not enough clean signal: {kept} of {n} segments. Please record again, sitting still with your eyes closed.',
    'eeg.st.baseline': 'Saved. {done} of {total} recordings so far. After that the app knows your usual rhythm.', 'eeg.st.within': 'Your resting rhythm is within your usual range.',
    'eeg.st.changed': 'Your resting rhythm is slower than your usual range. This has many everyday causes, such as drowsiness or some medicines, and it is not a diagnosis. Please record again on another day. If it stays this way, mention it to a doctor.',
    'eeg.st.sample': 'Compare the samples: in the healthy adult the alpha rhythm is strong and close to 10 per second.',
    'eeg.det.t': 'Details', 'eeg.det.ratio': 'Slow rhythm compared with alpha rhythm (theta/alpha)', 'eeg.det.cog': 'Speed of the alpha rhythm', 'eeg.det.hz': '{v} per second',
    'eeg.det.shares': 'Share of each rhythm', 'eeg.band.delta': 'Very slow (delta)', 'eeg.band.theta': 'Slow (theta)', 'eeg.band.alpha': 'Alpha', 'eeg.band.beta': 'Fast (beta)',
    'eeg.plot.x': 'waves per second (Hz)', 'eeg.plot.theta': 'slow', 'eeg.plot.alpha': 'alpha',
    'eeg.note': 'A headband gives a wellbeing-grade measurement. It is not a medical EEG, and this result does not change your status light.',
    'eeg.hist.t': 'Your recordings', 'eeg.hist.none': 'No recordings yet.', 'eeg.s.baseline': 'learning your usual rhythm', 'eeg.s.within': 'within your usual range', 'eeg.s.changed': 'slower than usual', 'eeg.s.unusable': 'not usable',
    'eeg.kind.muse': 'Muse-type headband', 'eeg.kind.brainbit': 'BrainBit-type headband', 'eeg.kind.clinical': 'Clinical EEG', 'eeg.kind.other': 'Other device',
    'eeg.live.t': 'Simulated headband', 'eeg.live.sig': 'Signal', 'eeg.live.ok': 'good', 'eeg.live.poor': 'adjust', 'eeg.live.left': '{s} s left · eyes closed, sit still',
    'eeg.again': 'Another recording', 'set.expEeg': 'Include my brain-rhythm results in the exported file',
    // clinician view
    'c.sec.eeg': 'Resting EEG (consumer headband)', 'c.eeg.none': 'The participant did not share EEG recordings.',
    'c.eeg.date': 'Date', 'c.eeg.dev': 'Device type', 'c.eeg.kept': 'Clean epochs', 'c.eeg.ratio': 'Theta/alpha ratio', 'c.eeg.cog': 'Alpha centre of gravity', 'c.eeg.z': 'z vs personal baseline (ratio; alpha)', 'c.eeg.status': 'Status',
    'c.eeg.s.baseline': 'baseline', 'c.eeg.s.within': 'within personal range', 'c.eeg.s.changed': 'slower than personal range', 'c.eeg.s.unusable': 'unusable',
    'c.eeg.note': 'Four-second epochs, 1–40 Hz, epochs beyond 200 µV rejected. z is computed on log(theta/alpha) and on the alpha centre of gravity against the first recordings of the same device type, with an assumed day-to-day SD; positive means slower. EEG slowing is not specific: drowsiness, sedative or anticholinergic medicines and metabolic causes produce it too. EEG does not enter the status rule.'
  });

  I.add('vi', {
    'eeg.card.t': 'Kiểm tra nhịp sóng não (tùy chọn)',
    'eeg.card.none': 'Nếu bạn có băng đo điện não (headband), một bản ghi 3 phút lúc nghỉ cho thêm một góc nhìn không phụ thuộc ngôn ngữ hay học vấn.',
    'eeg.card.done': 'Đã lưu {n} bản ghi · gần nhất ngày {date}', 'eeg.card.open': 'Mở',
    'eeg.t': 'Kiểm tra nhịp sóng não',
    'eeg.lead': 'Khi nghỉ và nhắm mắt, não tạo ra một nhịp đều khoảng 10 sóng mỗi giây, gọi là nhịp alpha. App theo dõi nhịp của chính bạn mạnh và nhanh đến đâu theo thời gian.',
    'eeg.how.t': 'Cách ghi', 'eeg.how.1': 'Ngồi thoải mái ở nơi yên tĩnh và đeo băng đo.', 'eeg.how.2': 'Nhắm mắt và ngồi yên trong 3 phút.', 'eeg.how.3': 'Lưu bản ghi thành file CSV bằng ứng dụng của băng đo, rồi chọn file đó ở đây.',
    'eeg.pick': 'Chọn file bản ghi', 'eeg.try.t': 'Chưa có băng đo? Xem cách hoạt động',
    'eeg.try.x': 'Các bản ghi mẫu này lấy từ một bộ dữ liệu nghiên cứu công khai, được chỉnh cho giống bản ghi của băng đo. Đây không phải dữ liệu của bạn và không được lưu.',
    'eeg.sample.CN': 'Mẫu: người trưởng thành khỏe mạnh', 'eeg.sample.AD': 'Mẫu: người mắc bệnh Alzheimer', 'eeg.sample.FTD': 'Mẫu: người sa sút trí tuệ trán–thái dương',
    'eeg.live': 'Băng đo mô phỏng (xem trực tiếp)', 'eeg.live.x': 'Phát lại một bản ghi mẫu như thể băng đo đang truyền tín hiệu, nhanh gấp 30 lần thời gian thật.',
    'eeg.busy': 'Đang phân tích bản ghi…', 'eeg.reading': 'Đang đọc file…',
    'eeg.rate.t': 'Băng đo ghi bao nhiêu mẫu mỗi giây?', 'eeg.rate.x': 'File không có cột thời gian dùng được. Hãy chọn tần số lấy mẫu của băng đo (xem hướng dẫn sử dụng).',
    'eeg.err.empty': 'File này trống hoặc quá ngắn.', 'eeg.err.noheader': 'Dòng đầu của file phải ghi tên các kênh.', 'eeg.err.nochannels': 'Không tìm thấy kênh điện não nào trong file (ví dụ TP9, AF7, O1).',
    'eeg.err.rate': 'App chưa hỗ trợ tần số lấy mẫu này.', 'eeg.err.big': 'File này quá lớn.', 'eeg.err.load': 'Không tải được bản ghi mẫu.',
    'eeg.res.t': 'Bản ghi của bạn', 'eeg.res.sample': 'Bản ghi mẫu', 'eeg.src': '{label}. Nguồn: {source}, dữ liệu nghiên cứu công khai. Không lưu.',
    'eeg.q.good': 'Chất lượng bản ghi: tốt. Có {kept} trên {n} đoạn sạch.', 'eeg.q.bad': 'Chưa đủ tín hiệu sạch: {kept} trên {n} đoạn. Bạn hãy ghi lại, ngồi yên và nhắm mắt.',
    'eeg.st.baseline': 'Đã lưu. Bạn đã có {done} trên {total} bản ghi. Sau đó app sẽ biết nhịp thường ngày của bạn.', 'eeg.st.within': 'Nhịp sóng não lúc nghỉ của bạn nằm trong khoảng thường ngày.',
    'eeg.st.changed': 'Nhịp sóng não lúc nghỉ của bạn chậm hơn khoảng thường ngày. Việc này có nhiều lý do hằng ngày, như buồn ngủ hoặc một số thuốc, và không phải là chẩn đoán. Bạn hãy ghi lại vào một ngày khác. Nếu vẫn như vậy, hãy nói với bác sĩ.',
    'eeg.st.sample': 'Hãy so các mẫu: ở người khỏe mạnh, nhịp alpha mạnh và gần 10 sóng mỗi giây.',
    'eeg.det.t': 'Chi tiết', 'eeg.det.ratio': 'Nhịp chậm so với nhịp alpha (theta/alpha)', 'eeg.det.cog': 'Tốc độ của nhịp alpha', 'eeg.det.hz': '{v} sóng mỗi giây',
    'eeg.det.shares': 'Tỉ trọng từng nhịp', 'eeg.band.delta': 'Rất chậm (delta)', 'eeg.band.theta': 'Chậm (theta)', 'eeg.band.alpha': 'Alpha', 'eeg.band.beta': 'Nhanh (beta)',
    'eeg.plot.x': 'số sóng mỗi giây (Hz)', 'eeg.plot.theta': 'chậm', 'eeg.plot.alpha': 'alpha',
    'eeg.note': 'Băng đo cho phép đo ở mức theo dõi sức khỏe. Đây không phải điện não đồ y khoa, và kết quả này không làm đổi màu đèn của bạn.',
    'eeg.hist.t': 'Các bản ghi của bạn', 'eeg.hist.none': 'Chưa có bản ghi nào.', 'eeg.s.baseline': 'đang ghi nhận nhịp thường ngày', 'eeg.s.within': 'trong khoảng thường ngày', 'eeg.s.changed': 'chậm hơn thường ngày', 'eeg.s.unusable': 'không dùng được',
    'eeg.kind.muse': 'Băng đo kiểu Muse', 'eeg.kind.brainbit': 'Băng đo kiểu BrainBit', 'eeg.kind.clinical': 'Điện não đồ lâm sàng', 'eeg.kind.other': 'Thiết bị khác',
    'eeg.live.t': 'Băng đo mô phỏng', 'eeg.live.sig': 'Tín hiệu', 'eeg.live.ok': 'tốt', 'eeg.live.poor': 'cần chỉnh', 'eeg.live.left': 'Còn {s} giây · nhắm mắt, ngồi yên',
    'eeg.again': 'Bản ghi khác', 'set.expEeg': 'Đưa kết quả nhịp sóng não vào file xuất ra',
    'c.sec.eeg': 'Điện não lúc nghỉ (headband tiêu dùng)', 'c.eeg.none': 'Người tham gia không chia sẻ bản ghi điện não.',
    'c.eeg.date': 'Ngày', 'c.eeg.dev': 'Loại thiết bị', 'c.eeg.kept': 'Epoch sạch', 'c.eeg.ratio': 'Tỉ lệ theta/alpha', 'c.eeg.cog': 'Trọng tâm tần số alpha', 'c.eeg.z': 'z so với mức nền cá nhân (tỉ lệ; alpha)', 'c.eeg.status': 'Trạng thái',
    'c.eeg.s.baseline': 'mức nền', 'c.eeg.s.within': 'trong khoảng cá nhân', 'c.eeg.s.changed': 'chậm hơn khoảng cá nhân', 'c.eeg.s.unusable': 'không dùng được',
    'c.eeg.note': 'Epoch 4 giây, 1–40 Hz, loại epoch vượt 200 µV. z tính trên log(theta/alpha) và trên trọng tâm tần số alpha, so với các bản ghi đầu tiên của cùng loại thiết bị, với độ lệch chuẩn giữa các ngày là giá trị giả định; giá trị dương nghĩa là chậm hơn. Điện não chậm không đặc hiệu: buồn ngủ, thuốc an thần hoặc kháng cholinergic và các nguyên nhân chuyển hóa cũng gây ra. Điện não không tham gia quy tắc trạng thái.'
  });
})();
