async function main() {
  const token = '8205e68a-8a8e-11f1-a973-aee5264794df';
  const shopId = 207610; // Sandbox Shop ID we retrieved!

  console.log('Testing Sandbox with correct credentials:');
  console.log('Token:', token);
  console.log('ShopID:', shopId);

  const body = {
    service_type_id: 2,
    from_district_id: 1442,
    from_ward_code: '20101',
    to_district_id: 1482,
    to_ward_code: '1A0111',
    weight: 500,
    length: 15,
    width: 15,
    height: 15,
  };

  try {
    const response = await fetch('https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/fee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Token: token,
        ShopId: String(shopId),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    console.log('Sandbox Response Status:', response.status);
    console.log('Sandbox Response Data:', data);
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
