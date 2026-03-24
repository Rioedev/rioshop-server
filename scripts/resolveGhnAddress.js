import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const token = process.env.GHN_API_KEY;
const baseUrl = process.env.GHN_MASTER_DATA_BASE_URL || "https://dev-online-gateway.ghn.vn/shiip/public-api/master-data";

const provinceKeyword = (process.argv[2] || "ha noi").toLowerCase().trim();
const districtKeyword = (process.argv[3] || "bac tu liem").toLowerCase().trim();
const wardKeyword = (process.argv[4] || "phu dien").toLowerCase().trim();

if (!token) {
  console.error("Missing GHN_API_KEY in .env");
  process.exit(1);
}

const normalize = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const findByKeyword = (list = [], field = "", keyword = "") =>
  list.find((item) => normalize(String(item?.[field] || "")).includes(normalize(keyword)));

const findByKeywordInNameExtensions = (list = [], keyword = "") =>
  list.find((item) => {
    const values = [item?.ProvinceName, item?.DistrictName, item?.WardName, ...(item?.NameExtension || [])].map(
      (value) => normalize(String(value || "")),
    );
    return values.some((value) => value.includes(normalize(keyword)));
  });

const headers = { Token: token };

const fetchDistrictsByProvince = async (provinceId) => {
  try {
    const postRes = await axios.post(
      `${baseUrl}/district`,
      { province_id: provinceId },
      { headers },
    );
    const districts = postRes.data?.data || [];
    if (districts.length > 0) {
      return districts;
    }
  } catch {
    // Try GET fallback below
  }

  const getRes = await axios.get(`${baseUrl}/district`, { headers });
  const allDistricts = getRes.data?.data || [];
  return allDistricts.filter((item) => Number(item?.ProvinceID) === Number(provinceId));
};

const run = async () => {
  const provinceRes = await axios.get(`${baseUrl}/province`, { headers });
  const provinces = provinceRes.data?.data || [];
  const provinceCandidates = provinces.filter((item) =>
    [item?.ProvinceName, ...(item?.NameExtension || [])]
      .map((value) => normalize(String(value || "")))
      .some((value) => value.includes(normalize(provinceKeyword))),
  );

  if (!provinceCandidates.length) {
    console.error("Province not found by keyword:", provinceKeyword);
    process.exit(2);
  }

  let selectedProvince = null;
  let selectedDistrict = null;

  for (const candidate of provinceCandidates) {
    const districts = await fetchDistrictsByProvince(candidate.ProvinceID);
    const district =
      findByKeyword(districts, "DistrictName", districtKeyword) ||
      findByKeywordInNameExtensions(districts, districtKeyword);
    if (district) {
      selectedProvince = candidate;
      selectedDistrict = district;
      break;
    }
  }

  if (!selectedProvince || !selectedDistrict) {
    console.error("District not found by keyword:", districtKeyword);
    console.error(
      "Matched provinces:",
      provinceCandidates.map((item) => `${item.ProvinceName} (${item.ProvinceID})`).join(", "),
    );
    process.exit(3);
  }

  const wardRes = await axios.get(`${baseUrl}/ward?district_id=${selectedDistrict.DistrictID}`, {
    headers,
  });
  const wards = wardRes.data?.data || [];
  const ward =
    findByKeyword(wards, "WardName", wardKeyword) ||
    findByKeywordInNameExtensions(wards, wardKeyword);

  if (!ward) {
    console.error("Ward not found by keyword:", wardKeyword);
    process.exit(4);
  }

  console.log("Province:", selectedProvince.ProvinceName, "-", selectedProvince.ProvinceID);
  console.log("District:", selectedDistrict.DistrictName, "-", selectedDistrict.DistrictID);
  console.log("Ward:", ward.WardName, "-", ward.WardCode);
  console.log("");
  console.log("Suggested .env values:");
  console.log(`GHN_FROM_PROVINCE_ID=${selectedProvince.ProvinceID}`);
  console.log(`GHN_FROM_DISTRICT_ID=${selectedDistrict.DistrictID}`);
  console.log(`GHN_FROM_WARD_CODE=${ward.WardCode}`);
};

run().catch((error) => {
  console.error("GHN master-data lookup failed:");
  console.error(error.response?.status, error.response?.data || error.message);
  process.exit(5);
});
