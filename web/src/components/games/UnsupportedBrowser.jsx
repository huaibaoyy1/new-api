/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

const UnsupportedBrowser = () => {
  const { t } = useTranslation();

  return (
    <div className='min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 bg-semi-color-bg-0'>
      <Card className='w-full max-w-2xl text-center'>
        <div className='flex justify-center mb-5'>
          <div className='w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center'>
            <IconAlertTriangle size='extra-large' className='text-orange-500' />
          </div>
        </div>

        <Title heading={3} className='!mb-3'>
          {t('当前浏览器不支持游戏板块')}
        </Title>

        <Paragraph className='!mb-6'>
          <Text type='secondary'>
            {t(
              '为了保证游戏功能稳定运行，游戏板块仅支持电脑端 Google Chrome 或 Microsoft Edge 浏览器访问，手机和平板暂不支持。',
            )}
          </Text>
        </Paragraph>

        <Space wrap spacing='medium' className='justify-center'>
          <Button
            theme='solid'
            type='primary'
            onClick={() => window.open('https://www.google.com/chrome/', '_blank')}
          >
            {t('下载 Chrome')}
          </Button>
          <Button
            onClick={() => window.open('https://www.microsoft.com/edge', '_blank')}
          >
            {t('下载 Edge')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default UnsupportedBrowser;
