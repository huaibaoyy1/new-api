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
import { Banner } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const GameRiskNotice = ({ className = '' }) => {
  const { t } = useTranslation();

  return (
    <Banner
      type='warning'
      closeIcon={null}
      className={className}
      title={t('游戏风险提示与免责声明')}
      description={
        <div className='space-y-1 text-sm leading-6'>
          <div>{t('游戏板块仅为站内娱乐功能，不构成任何形式的投资、博彩、抽奖销售或获利承诺。')}</div>
          <div>{t('游戏结果包含随机性，消耗和获得的站内余额、注册码、消费码等仅限本站规则内使用，不可提现、不可转让、不可兑换法定货币或其他现金等价物。')}</div>
          <div>{t('请确认您所在地区允许使用此类娱乐功能；未成年人及受当地法律法规限制的用户不得参与。')}</div>
          <div>{t('请理性参与并自行控制使用频率和成本。继续使用游戏功能，即表示您已理解并接受相关规则、随机性和可能损失站内余额的风险。')}</div>
          <div>{t('以上提示不构成法律意见；如您对当地合规要求有疑问，请先咨询专业法律人士。')}</div>
        </div>
      }
    />
  );
};

export default GameRiskNotice;
