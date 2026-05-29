// One-off seed for storefront chrome (header/footer/promo bar via BrandConfig)
// and customer-facing policies (strip chips + full pages).
//
// Run: `npm run seed:chrome` from the server directory.
// Idempotent: BrandConfig is upserted by brandKey; policies are upserted by (kind, slug for pages / title for strips).

import dotenv from "dotenv";
import slugify from "slugify";

import connectDB from "../src/config/database.js";
import BrandConfig from "../src/models/BrandConfig.js";
import Policy from "../src/models/Policy.js";

dotenv.config();

const BRAND_KEY = "rioshop-default";
const now = new Date();

// ------------- BrandConfig chrome fields -------------
const upsertBrandChrome = async () => {
  const update = {
    $set: {
      // Contact / hotline (header + footer)
      supportPhone: "1900 8888",
      supportEmail: "chamsockhachhang@rioshop.vn",
      supportHotlineNote: "Bấm phím 1 để được tư vấn mua hàng",
      supportHotlineNoteSecondary: "Bấm phím 2 để góp ý, khiếu nại",
      storeAddress:
        "Tầng 5, Tòa nhà Rio Tower, Số 1 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh",

      // Social
      "socialLinks.facebook": "https://www.facebook.com/rioshop.vn",
      "socialLinks.instagram": "https://www.instagram.com/rioshop.vn",
      "socialLinks.tiktok": "https://www.tiktok.com/@rioshop.vn",
      "socialLinks.youtube": "https://www.youtube.com/@rioshop",
      "socialLinks.zalo": "https://zalo.me/rioshop",
      "socialLinks.messenger": "https://m.me/rioshop.vn",

      // Promo bar
      "storefront.promoBar.text":
        "FLASH SALE 10H - 14H | Giảm đến 50% + Freeship toàn quốc",
      "storefront.promoBar.isActive": true,

      // Footer copy
      "storefront.footer.introHeading": "RIOSHOP XIN CHÀO 💖",
      "storefront.footer.intro":
        "Chúng tôi luôn quý trọng và tiếp thu mọi ý kiến đóng góp từ khách hàng, nhằm không ngừng cải thiện và nâng tầm trải nghiệm dịch vụ cùng chất lượng sản phẩm.",
      "storefront.footer.newsletterPlaceholder":
        "Nhập địa chỉ email của bạn để nhận ưu đãi",
      "storefront.footer.companyName":
        "© CÔNG TY CỔ PHẦN THỜI TRANG RIOSHOP",
      "storefront.footer.companyLegalText":
        "Mã số doanh nghiệp: 0801206940. Giấy chứng nhận đăng ký doanh nghiệp do Sở Kế hoạch và Đầu tư TP Hồ Chí Minh cấp lần đầu ngày 04/03/2017.",
      "storefront.footer.complianceBadges": [
        "DMCA PROTECTED",
        "ĐÃ THÔNG BÁO BỘ CÔNG THƯƠNG",
      ],

      updatedAt: now,
    },
    $setOnInsert: {
      brandKey: BRAND_KEY,
      displayName: "Rioshop",
    },
  };

  await BrandConfig.findOneAndUpdate(
    { brandKey: BRAND_KEY },
    update,
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
};

// ------------- Policy strip chips -------------
const STRIP_POLICIES = [
  {
    title: "Miễn phí đổi trả 60 ngày",
    iconKey: "RetweetOutlined",
    summary: "Đổi trả dễ dàng trong vòng 60 ngày kể từ khi nhận hàng.",
    position: 1,
  },
  {
    title: "Miễn phí ship đơn từ 499K",
    iconKey: "TruckOutlined",
    summary: "Áp dụng cho mọi đơn hàng từ 499.000đ trên toàn quốc.",
    position: 2,
  },
  {
    title: "Kiểm tra hàng trước khi nhận",
    iconKey: "SafetyCertificateOutlined",
    summary: "Bạn được mở kiện kiểm tra trước khi thanh toán cho shipper.",
    position: 3,
  },
  {
    title: "Hotline 1900 8888",
    iconKey: "CustomerServiceOutlined",
    summary: "CSKH hỗ trợ từ 8h đến 22h tất cả các ngày trong tuần.",
    position: 4,
  },
];

// ------------- Policy pages (full content) -------------
const PAGE_POLICIES = [
  {
    title: "Chính sách đổi trả",
    slug: "doi-tra",
    summary:
      "Quy định về việc đổi, trả sản phẩm trong vòng 60 ngày kể từ khi nhận hàng.",
    position: 1,
    content: `
<h2>1. Thời gian đổi trả</h2>
<p>Quý khách được đổi trả sản phẩm trong vòng <strong>60 ngày</strong> kể từ ngày nhận hàng, áp dụng cho mọi đơn hàng mua tại Rioshop.</p>

<h2>2. Điều kiện đổi trả</h2>
<ul>
  <li>Sản phẩm còn nguyên tem, mác, chưa qua sử dụng hoặc giặt tẩy.</li>
  <li>Có hóa đơn / mã đơn hàng kèm theo.</li>
  <li>Không áp dụng đổi trả với đồ lót, phụ kiện cá nhân và sản phẩm thuộc chương trình "Final Sale".</li>
</ul>

<h2>3. Hình thức đổi trả</h2>
<p>Quý khách có thể chọn một trong hai hình thức:</p>
<ul>
  <li><strong>Đổi sản phẩm khác:</strong> miễn phí phần chênh lệch nếu cùng nhóm giá.</li>
  <li><strong>Hoàn tiền:</strong> hoàn về tài khoản đã thanh toán trong 3 – 7 ngày làm việc.</li>
</ul>

<h2>4. Quy trình</h2>
<ol>
  <li>Liên hệ hotline <strong>1900 8888</strong> hoặc inbox fanpage để mở yêu cầu.</li>
  <li>Đóng gói sản phẩm kèm hóa đơn và gửi theo địa chỉ Rioshop hướng dẫn.</li>
  <li>Rioshop kiểm tra và xác nhận đổi / hoàn tiền trong vòng 48 giờ.</li>
</ol>

<blockquote>Mọi thắc mắc về chính sách đổi trả, vui lòng liên hệ CSKH để được hỗ trợ trực tiếp.</blockquote>
`.trim(),
  },
  {
    title: "Chính sách vận chuyển",
    slug: "van-chuyen",
    summary:
      "Thông tin về thời gian giao hàng, phí ship và các đơn vị vận chuyển Rioshop hợp tác.",
    position: 2,
    content: `
<h2>1. Phí vận chuyển</h2>
<ul>
  <li><strong>Miễn phí giao hàng</strong> cho đơn hàng từ <strong>499.000đ</strong> trở lên.</li>
  <li>Đơn hàng dưới 499.000đ: phí ship 25.000đ – 40.000đ tùy khu vực.</li>
</ul>

<h2>2. Thời gian giao hàng</h2>
<table>
  <thead>
    <tr><th>Khu vực</th><th>Thời gian dự kiến</th></tr>
  </thead>
  <tbody>
    <tr><td>Nội thành TP.HCM, Hà Nội</td><td>1 – 2 ngày làm việc</td></tr>
    <tr><td>Các tỉnh thành khác</td><td>2 – 4 ngày làm việc</td></tr>
    <tr><td>Khu vực vùng sâu, hải đảo</td><td>4 – 7 ngày làm việc</td></tr>
  </tbody>
</table>

<h2>3. Đơn vị vận chuyển</h2>
<p>Rioshop hợp tác với <strong>Giao hàng nhanh (GHN)</strong>, <strong>Giao hàng tiết kiệm (GHTK)</strong> và <strong>Viettel Post</strong> để đảm bảo đơn hàng đến tay khách trong thời gian sớm nhất.</p>

<h2>4. Theo dõi đơn hàng</h2>
<p>Sau khi đặt hàng thành công, mã vận đơn sẽ được gửi qua email và hiển thị trong mục <strong>"Đơn của tôi"</strong>. Quý khách có thể tra cứu trạng thái giao hàng bất cứ lúc nào.</p>
`.trim(),
  },
  {
    title: "Chính sách bảo mật",
    slug: "bao-mat",
    summary:
      "Cam kết của Rioshop về việc thu thập, sử dụng và bảo vệ thông tin cá nhân của khách hàng.",
    position: 3,
    content: `
<h2>1. Thông tin chúng tôi thu thập</h2>
<p>Rioshop chỉ thu thập những thông tin cần thiết để xử lý đơn hàng và cải thiện trải nghiệm mua sắm, bao gồm:</p>
<ul>
  <li>Họ tên, số điện thoại, email, địa chỉ giao hàng.</li>
  <li>Lịch sử mua sắm và tương tác trên website.</li>
  <li>Cookies kỹ thuật để duy trì phiên đăng nhập và cá nhân hóa nội dung.</li>
</ul>

<h2>2. Mục đích sử dụng</h2>
<ul>
  <li>Xử lý đơn hàng, giao nhận và chăm sóc sau bán.</li>
  <li>Gửi thông báo về tình trạng đơn hàng, chương trình khuyến mại mà quý khách đã đăng ký.</li>
  <li>Phân tích và cải thiện chất lượng dịch vụ.</li>
</ul>

<h2>3. Cam kết bảo mật</h2>
<p>Rioshop <strong>không chia sẻ thông tin cá nhân</strong> của khách hàng cho bên thứ ba vì mục đích thương mại. Mọi dữ liệu được lưu trữ an toàn và chỉ truy cập bởi nhân sự được ủy quyền.</p>

<h2>4. Quyền của khách hàng</h2>
<p>Quý khách có quyền yêu cầu xem, chỉnh sửa hoặc xóa thông tin cá nhân của mình bằng cách liên hệ <strong>chamsockhachhang@rioshop.vn</strong>.</p>
`.trim(),
  },
  {
    title: "Điều khoản dịch vụ",
    slug: "dieu-khoan",
    summary:
      "Các điều khoản chung khi sử dụng website và dịch vụ mua sắm tại Rioshop.",
    position: 4,
    content: `
<h2>1. Chấp nhận điều khoản</h2>
<p>Khi truy cập và sử dụng dịch vụ tại <strong>Rioshop</strong>, quý khách đồng ý tuân thủ các điều khoản dưới đây. Nếu không đồng ý, vui lòng dừng sử dụng dịch vụ.</p>

<h2>2. Tài khoản người dùng</h2>
<ul>
  <li>Quý khách chịu trách nhiệm bảo mật thông tin đăng nhập của tài khoản.</li>
  <li>Mọi hoạt động phát sinh từ tài khoản đều được coi là do chủ tài khoản thực hiện.</li>
  <li>Rioshop có quyền tạm khóa tài khoản nếu phát hiện hành vi gian lận, lạm dụng dịch vụ.</li>
</ul>

<h2>3. Đặt hàng và thanh toán</h2>
<ul>
  <li>Đơn hàng được xác nhận khi quý khách nhận được email / thông báo xác nhận từ Rioshop.</li>
  <li>Rioshop chấp nhận thanh toán qua MoMo, VNPay, chuyển khoản ngân hàng và COD.</li>
  <li>Trong trường hợp sản phẩm hết hàng sau khi đặt, Rioshop sẽ liên hệ và hoàn tiền 100% nếu quý khách đã thanh toán trước.</li>
</ul>

<h2>4. Quyền sở hữu trí tuệ</h2>
<p>Toàn bộ nội dung, hình ảnh, logo trên website thuộc quyền sở hữu của Rioshop. Mọi hình thức sao chép, phân phối khi chưa được cho phép đều vi phạm pháp luật về sở hữu trí tuệ.</p>

<h2>5. Thay đổi điều khoản</h2>
<p>Rioshop có quyền cập nhật các điều khoản này bất kỳ lúc nào. Phiên bản mới sẽ có hiệu lực ngay sau khi đăng tải trên website.</p>
`.trim(),
  },
];

const upsertPolicies = async () => {
  let inserted = 0;
  let updated = 0;

  for (const item of STRIP_POLICIES) {
    const filter = { kind: "strip", title: item.title, deletedAt: null };
    const existed = await Policy.findOne(filter);
    await Policy.findOneAndUpdate(
      filter,
      {
        $set: {
          kind: "strip",
          title: item.title,
          iconKey: item.iconKey,
          summary: item.summary,
          position: item.position,
          isActive: true,
          slug: "",
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    existed ? (updated += 1) : (inserted += 1);
  }

  for (const item of PAGE_POLICIES) {
    const slug = slugify(item.slug, { lower: true, strict: true });
    const filter = { kind: "page", slug, deletedAt: null };
    const existed = await Policy.findOne(filter);
    await Policy.findOneAndUpdate(
      filter,
      {
        $set: {
          kind: "page",
          title: item.title,
          slug,
          summary: item.summary,
          content: item.content,
          position: item.position,
          isActive: true,
          iconKey: "",
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    existed ? (updated += 1) : (inserted += 1);
  }

  return { inserted, updated };
};

const main = async () => {
  await connectDB();

  await upsertBrandChrome();
  const { inserted, updated } = await upsertPolicies();

  console.log("Seed storefront chrome + policies completed:");
  console.log(`- Brand config (chrome): ${BRAND_KEY}`);
  console.log(`- Strip policies: ${STRIP_POLICIES.length}`);
  console.log(`- Page policies: ${PAGE_POLICIES.length}`);
  console.log(`- Policies inserted: ${inserted}, updated: ${updated}`);
};

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.connection.close();
    process.exit(0);
  });
